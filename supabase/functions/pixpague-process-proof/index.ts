// Edge function dedicada APENAS ao PixPague do módulo Consultar Cliente.
// Faz: (1) OCR do comprovante via IA configurada, (2) verifica ID duplicado,
// (3) envia notificação WhatsApp para os aprovadores configurados.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OcrResult {
  amount: number | null;
  transactionId: string | null;
  status: 'success' | 'error' | 'skipped';
  raw?: string;
}

async function runOcr(
  proofUrl: string,
  provider: string,
  geminiKey: string | null,
  openaiKey: string | null,
  groqKey: string | null,
): Promise<OcrResult> {
  try {
    const imageResponse = await fetch(proofUrl);
    if (!imageResponse.ok) {
      return { amount: null, transactionId: null, status: 'error', raw: 'Failed to fetch proof' };
    }
    const blob = await imageResponse.blob();
    const buf = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const mime = blob.type || 'image/jpeg';

    const prompt = `Você é um especialista em comprovantes de PIX brasileiros. Analise a imagem e extraia:
1. valor pago (numérico decimal, sem R$, ex: 49.90)
2. ID da transação / Código E2E (string longa alfanumérica, geralmente começa com "E" e tem ~32 chars)

Responda APENAS um JSON válido: {"amount": 49.90, "transactionId": "E12345..."}
Se não encontrar algum campo, use null.`;

    // 1) Try Gemini
    if (provider === 'gemini' && geminiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }],
          generationConfig: { response_mime_type: 'application/json' },
        }),
      });
      const j = await r.json();
      const txt = j.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) {
        const parsed = JSON.parse(txt);
        return {
          amount: parsed.amount != null ? Number(parsed.amount) : null,
          transactionId: parsed.transactionId || null,
          status: 'success',
        };
      }
    }

    // 2) Try OpenAI
    if (provider === 'openai' && openaiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content;
      if (txt) {
        const parsed = JSON.parse(txt);
        return {
          amount: parsed.amount != null ? Number(parsed.amount) : null,
          transactionId: parsed.transactionId || null,
          status: 'success',
        };
      }
    }

    // 3) Try Groq (text-only fallback - cannot read image, returns skipped)
    if (provider === 'groq' && groqKey) {
      return { amount: null, transactionId: null, status: 'skipped', raw: 'Groq does not support vision' };
    }

    return { amount: null, transactionId: null, status: 'skipped', raw: 'No AI key configured' };
  } catch (e: any) {
    console.error('OCR error:', e);
    return { amount: null, transactionId: null, status: 'error', raw: e?.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { paymentId, proofUrl, declaredAmount } = await req.json();
    if (!paymentId || !proofUrl) {
      return new Response(JSON.stringify({ error: 'paymentId and proofUrl required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Load PixPague config
    const { data: cfgRow } = await supabase
      .from('billing_config')
      .select('config_value')
      .eq('config_key', 'pixpague_config')
      .single();

    const cfg = cfgRow?.config_value ? JSON.parse(cfgRow.config_value) : {
      ocr_enabled: true, duplicate_check: true, whatsapp_notifications: false,
      approver_phones: '', ai_provider: 'gemini',
    };

    // Run OCR if enabled
    let ocr: OcrResult = { amount: null, transactionId: null, status: 'skipped' };
    if (cfg.ocr_enabled) {
      ocr = await runOcr(
        proofUrl,
        cfg.ai_provider || 'gemini',
        Deno.env.get('GEMINI_API_KEY') || null,
        Deno.env.get('OPENAI_API_KEY') || null,
        Deno.env.get('GROQ_API_KEY') || null,
      );
    }

    // Check for duplicate transaction ID
    let isDuplicate = false;
    let duplicatePayment: any = null;
    if (cfg.duplicate_check && ocr.transactionId) {
      const { data: dup } = await supabase
        .from('client_payments')
        .select('id, cliente_id, amount, paid_at')
        .eq('pix_transaction_id', ocr.transactionId)
        .neq('id', paymentId)
        .limit(1);
      if (dup && dup.length > 0) {
        isDuplicate = true;
        duplicatePayment = dup[0];
      }
    }

    // Determine status
    let ocrStatus: string = 'pending';
    if (ocr.status === 'skipped') ocrStatus = 'skipped';
    else if (ocr.status === 'error') ocrStatus = 'error';
    else if (isDuplicate) ocrStatus = 'duplicate';
    else if (ocr.amount != null && declaredAmount != null) {
      ocrStatus = Math.abs(ocr.amount - Number(declaredAmount)) < 0.01 ? 'success' : 'mismatch';
    } else if (ocr.status === 'success') ocrStatus = 'success';

    // Update payment record
    await supabase
      .from('client_payments')
      .update({
        pix_transaction_id: ocr.transactionId,
        ocr_amount: ocr.amount,
        ocr_status: ocrStatus,
      })
      .eq('id', paymentId);

    // Send WhatsApp notification if enabled and there's a problem to flag
    if (cfg.whatsapp_notifications && cfg.approver_phones && (ocrStatus === 'duplicate' || ocrStatus === 'mismatch' || ocrStatus === 'success')) {
      // Try to find a configured WhatsApp instance from billing_whatsapp_instances
      const { data: instance } = await supabase
        .from('billing_whatsapp_instances')
        .select('api_url, api_key, instance_name')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (instance) {
        const { data: payment } = await supabase
          .from('client_payments')
          .select('amount, cliente:clientes(nome, produto)')
          .eq('id', paymentId)
          .single();

        const cliente: any = payment?.cliente;
        let icon = '✅';
        let label = 'Validado';
        if (ocrStatus === 'mismatch') { icon = '⚠️'; label = `DIVERGENTE (IA leu R$ ${ocr.amount?.toFixed(2)})`; }
        if (ocrStatus === 'duplicate') { icon = '🚫'; label = 'ID DUPLICADO — POSSÍVEL FRAUDE'; }

        const message = `${icon} *PixPague — Pagamento Recebido*\n\n` +
          `👤 Cliente: ${cliente?.nome || 'N/A'}\n` +
          `📦 Produto: ${cliente?.produto || 'N/A'}\n` +
          `💰 Valor digitado: R$ ${Number(declaredAmount || payment?.amount || 0).toFixed(2)}\n` +
          `🔍 Status: ${label}\n` +
          (ocr.transactionId ? `🆔 TX: ${ocr.transactionId}\n` : '') +
          (isDuplicate ? `\n⚠️ Esse ID já foi usado em outro pagamento!` : '');

        const phones = String(cfg.approver_phones).split(',').map((p: string) => p.trim()).filter(Boolean);
        for (const phone of phones) {
          try {
            await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': instance.api_key },
              body: JSON.stringify({ number: phone.replace(/\D/g, ''), text: message }),
            });
          } catch (e) {
            console.error(`WhatsApp send failed for ${phone}:`, e);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ocr_status: ocrStatus,
      ocr_amount: ocr.amount,
      transaction_id: ocr.transactionId,
      is_duplicate: isDuplicate,
      duplicate_payment: duplicatePayment,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('pixpague-process-proof error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
