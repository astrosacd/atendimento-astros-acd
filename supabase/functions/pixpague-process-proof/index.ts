// Edge function dedicada APENAS ao PixPague do módulo Consultar Cliente.
// Faz: (1) OCR do comprovante via Lovable AI (Gemini Vision), (2) verifica ID duplicado,
// (3) envia notificação WhatsApp para os aprovadores configurados.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OcrResult {
  amount: number | null;
  transactionId: string | null;
  status: 'success' | 'error' | 'skipped' | 'invalid';
  isReceipt?: boolean;
  reason?: string;
  raw?: string;
}

async function runOcr(
  proofUrl: string,
  provider: string,
  model: string,
  lovableKey: string | null,
  openaiKey: string | null,
  groqKey: string | null,
): Promise<OcrResult> {
  try {
    console.log('[OCR] Starting OCR. Provider:', provider, 'Model:', model);
    const imageResponse = await fetch(proofUrl);
    if (!imageResponse.ok) {
      console.error('[OCR] Failed to fetch proof image:', imageResponse.status);
      return { amount: null, transactionId: null, status: 'error', raw: 'Failed to fetch proof' };
    }
    const blob = await imageResponse.blob();
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);
    const mime = blob.type || 'image/jpeg';
    console.log('[OCR] Image fetched. size:', bytes.length, 'mime:', mime);

    const prompt = `Você é um especialista em comprovantes de PIX brasileiros. PRIMEIRO determine se a imagem É REALMENTE um comprovante de pagamento PIX (deve conter elementos típicos como: valor pago, data, nome do banco, ID da transação, beneficiário, etc).

Se NÃO for um comprovante de PIX válido (ex: foto aleatória, screenshot de outra coisa, imagem em branco, meme, paisagem, etc), responda:
{"isReceipt": false, "amount": null, "transactionId": null, "reason": "descreva brevemente o que a imagem realmente mostra"}

Se FOR um comprovante de PIX válido, extraia:
1. **valor pago** (numérico decimal, sem R$, sem símbolos, ex: 49.90)
2. **ID da transação / Código E2E** (string longa alfanumérica, geralmente começa com "E" e tem ~32 caracteres)

Responda APENAS um JSON válido no formato:
{"isReceipt": true, "amount": 49.90, "transactionId": "E12345..."}

Se for comprovante mas não encontrar algum campo, use null para esse campo. NÃO invente valores.`;

    const parseJsonResponse = (txt: string): OcrResult | null => {
      const jsonMatch = txt.match(/\{[\s\S]*?\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : txt;
      try {
        const parsed = JSON.parse(jsonStr);
        const isReceipt = parsed.isReceipt !== false; // default true if not specified (legacy)
        return {
          amount: parsed.amount != null ? Number(parsed.amount) : null,
          transactionId: parsed.transactionId || null,
          status: isReceipt ? 'success' : 'invalid',
          isReceipt,
          reason: parsed.reason || undefined,
          raw: txt,
        };
      } catch (e) {
        console.error('[OCR] JSON parse error:', e, 'raw:', txt);
        return null;
      }
    };

    // === Provider: OpenAI (user-supplied key) ===
    if (provider === 'openai') {
      if (!openaiKey) {
        console.warn('[OCR] OpenAI selected but no API key provided.');
        return { amount: null, transactionId: null, status: 'skipped', raw: 'OpenAI key missing' };
      }
      console.log('[OCR] Using OpenAI gpt-4o...');
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          }],
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error('[OCR] OpenAI error:', r.status, err);
        return { amount: null, transactionId: null, status: 'error', raw: err };
      }
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content;
      if (txt) {
        const parsed = parseJsonResponse(txt);
        if (parsed) return parsed;
      }
    }

    // === Provider: Groq (user-supplied key) ===
    if (provider === 'groq') {
      if (!groqKey) {
        console.warn('[OCR] Groq selected but no API key provided.');
        return { amount: null, transactionId: null, status: 'skipped', raw: 'Groq key missing' };
      }
      console.log('[OCR] Using Groq llama-3.2-90b-vision-preview...');
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.2-90b-vision-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          }],
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error('[OCR] Groq error:', r.status, err);
        return { amount: null, transactionId: null, status: 'error', raw: err };
      }
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content;
      if (txt) {
        const parsed = parseJsonResponse(txt);
        if (parsed) return parsed;
      }
    }

    // === Provider: Lovable AI (default — also handles legacy "gemini"/"google" values) ===
    const isLovable = !provider || ['lovable', 'gemini', 'google', 'lovable-ai'].includes(provider.toLowerCase());
    if (isLovable) {
      if (!lovableKey) {
        console.warn('[OCR] Lovable AI key not configured.');
        return { amount: null, transactionId: null, status: 'skipped', raw: 'Lovable AI key missing' };
      }
      const useModel = model || 'google/gemini-2.5-flash';
      console.log('[OCR] Using Lovable AI Gateway with model:', useModel);
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: useModel,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          }],
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error('[OCR] Lovable AI error:', r.status, err);
        if (r.status === 429) return { amount: null, transactionId: null, status: 'error', raw: 'Limite Lovable AI atingido. Aguarde ou troque para OpenAI/Groq.' };
        if (r.status === 402) return { amount: null, transactionId: null, status: 'error', raw: 'Créditos Lovable AI esgotados. Adicione créditos ou troque para OpenAI/Groq.' };
        return { amount: null, transactionId: null, status: 'error', raw: err };
      }
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content;
      if (txt) {
        const parsed = parseJsonResponse(txt);
        if (parsed) return parsed;
      }
    }

    console.warn('[OCR] No AI provider succeeded.');
    return { amount: null, transactionId: null, status: 'skipped', raw: 'No AI provider available' };
  } catch (e: any) {
    console.error('[OCR] Unexpected error:', e);
    return { amount: null, transactionId: null, status: 'error', raw: e?.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { paymentId, proofUrl, declaredAmount, manualReview } = await req.json();
    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'paymentId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!proofUrl && !manualReview) {
      return new Response(JSON.stringify({ error: 'proofUrl required (or set manualReview=true)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[pixpague] Processing payment:', paymentId, 'declared:', declaredAmount, 'manualReview:', !!manualReview);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Load PixPague config
    const { data: cfgRow } = await supabase
      .from('billing_config')
      .select('config_value')
      .eq('config_key', 'pixpague_config')
      .single();

    const cfg = cfgRow?.config_value
      ? (typeof cfgRow.config_value === 'string' ? JSON.parse(cfgRow.config_value) : cfgRow.config_value)
      : {
          ocr_enabled: true, duplicate_check: true, whatsapp_notifications: false,
          approver_phones: '', ai_provider: 'lovable', ai_model: 'google/gemini-2.5-flash',
        };

    console.log('[pixpague] Config:', { ...cfg, openai_api_key: cfg.openai_api_key ? '***' : '', groq_api_key: cfg.groq_api_key ? '***' : '' });

    // Run OCR if enabled and not a manual-review submission
    let ocr: OcrResult = { amount: null, transactionId: null, status: 'skipped' };
    if (!manualReview && proofUrl && cfg.ocr_enabled !== false) {
      ocr = await runOcr(
        proofUrl,
        cfg.ai_provider || 'lovable',
        cfg.ai_model || 'google/gemini-2.5-flash',
        Deno.env.get('LOVABLE_API_KEY') || null,
        cfg.openai_api_key || null,
        cfg.groq_api_key || null,
      );
    }

    console.log('[pixpague] OCR result:', ocr);

    // Check for duplicate transaction ID
    let isDuplicate = false;
    let duplicatePayment: any = null;
    if (cfg.duplicate_check !== false && ocr.transactionId) {
      const { data: dup } = await supabase
        .from('client_payments')
        .select('id, cliente_id, amount, paid_at')
        .eq('pix_transaction_id', ocr.transactionId)
        .neq('id', paymentId)
        .limit(1);
      if (dup && dup.length > 0) {
        isDuplicate = true;
        duplicatePayment = dup[0];
        console.warn('[pixpague] DUPLICATE detected:', ocr.transactionId);
      }
    }

    // Determine status
    let ocrStatus: string = 'pending';
    if (manualReview) ocrStatus = 'manual_review';
    else if (ocr.status === 'skipped') ocrStatus = 'skipped';
    else if (ocr.status === 'error') ocrStatus = 'error';
    else if (ocr.status === 'invalid' || ocr.isReceipt === false) ocrStatus = 'invalid';
    else if (isDuplicate) ocrStatus = 'duplicate';
    else if (ocr.amount == null && ocr.transactionId == null) {
      ocrStatus = 'invalid';
    } else if (ocr.amount != null && declaredAmount != null) {
      ocrStatus = Math.abs(ocr.amount - Number(declaredAmount)) < 0.01 ? 'success' : 'mismatch';
    } else if (ocr.amount == null && declaredAmount != null) {
      ocrStatus = 'mismatch';
    } else if (ocr.status === 'success') ocrStatus = 'success';

    console.log('[pixpague] Final ocrStatus:', ocrStatus, '| isReceipt:', ocr.isReceipt, '| reason:', ocr.reason);

    // Update payment record
    const updateData: any = { ocr_status: ocrStatus };
    if (ocr.transactionId) updateData.pix_transaction_id = ocr.transactionId;
    if (ocr.amount != null) updateData.ocr_amount = ocr.amount;

    await supabase
      .from('client_payments')
      .update(updateData)
      .eq('id', paymentId);

    // Send WhatsApp notification if enabled — notify for ALL statuses (including invalid/error/pending)
    // so admins are alerted immediately, even when proof is fake/wrong/unreadable.
    if (cfg.whatsapp_notifications && cfg.approver_phones) {
      const { data: instance } = await supabase
        .from('billing_whatsapp_instances')
        .select('api_url, api_key, instance_name')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (instance) {
        // Fetch payment + client + submitter info for full traceability
        const { data: payment } = await supabase
          .from('client_payments')
          .select('amount, submitted_by_name, submitted_by_email, cliente:clientes(nome, produto, cobranca_ativa)')
          .eq('id', paymentId)
          .single();

        const cliente: any = payment?.cliente;
        const typeLabel = cliente?.cobranca_ativa === false ? 'Apenas Registro' : 'Mensal';
        let icon = '✅';
        let label = 'Validado';
        if (ocrStatus === 'mismatch') { icon = '⚠️'; label = `DIVERGENTE (IA leu R$ ${ocr.amount?.toFixed(2)})`; }
        else if (ocrStatus === 'duplicate') { icon = '🚫'; label = 'ID DUPLICADO — POSSÍVEL FRAUDE'; }
        else if (ocrStatus === 'invalid') { icon = '❌'; label = 'COMPROVANTE INVÁLIDO (não é PIX)'; }
        else if (ocrStatus === 'error') { icon = '⚠️'; label = 'ERRO ao processar OCR'; }
        else if (ocrStatus === 'skipped') { icon = '📨'; label = 'OCR desativado — revisão manual'; }
        else if (ocrStatus === 'pending') { icon = '⏳'; label = 'Aguardando processamento'; }

        const submitterLine = payment?.submitted_by_name || payment?.submitted_by_email
          ? `\n🧑‍💼 Enviado por: ${payment?.submitted_by_name || ''}${payment?.submitted_by_email ? ` (${payment.submitted_by_email})` : ''}`
          : '';

        const reasonLine = (ocrStatus === 'invalid' && ocr.reason)
          ? `\n📝 Motivo: ${ocr.reason}`
          : '';

        const message = `${icon} *PixPague — Pagamento para Análise*\n\n` +
          `👤 Cliente: ${cliente?.nome || 'N/A'}\n` +
          `📝 Tipo: ${typeLabel}\n` +
          `📦 Produto: ${cliente?.produto || 'N/A'}\n` +
          `💰 Valor digitado: R$ ${Number(declaredAmount || payment?.amount || 0).toFixed(2)}\n` +
          `🔍 Status: ${label}` +
          (ocr.transactionId ? `\n🆔 TX: ${ocr.transactionId}` : '') +
          reasonLine +
          submitterLine +
          (isDuplicate ? `\n\n⚠️ Esse ID já foi usado em outro pagamento!` : '') +
          `\n\n👉 Acesse o módulo *Segurança de Pagamento* para analisar e aprovar.`;

        const phones = String(cfg.approver_phones).split(',').map((p: string) => p.trim()).filter(Boolean);
        for (const phone of phones) {
          try {
            await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': instance.api_key },
              body: JSON.stringify({ number: phone.replace(/\D/g, ''), text: message }),
            });
            console.log(`[pixpague] WhatsApp notification sent to ${phone} for status: ${ocrStatus}`);
          } catch (e) {
            console.error(`WhatsApp send failed for ${phone}:`, e);
          }
        }
      } else {
        console.warn('[pixpague] No active WhatsApp instance found — skipping notification.');
      }
    } else {
      console.log('[pixpague] WhatsApp notification skipped. enabled:', cfg.whatsapp_notifications, 'phones:', !!cfg.approver_phones);
    }

    return new Response(JSON.stringify({
      success: true,
      ocr_status: ocrStatus,
      ocr_amount: ocr.amount,
      transaction_id: ocr.transactionId,
      is_duplicate: isDuplicate,
      duplicate_payment: duplicatePayment,
      raw: ocr.raw,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[pixpague] error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
