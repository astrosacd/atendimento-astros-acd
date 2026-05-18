import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Max-Age': '86400',
};

const utf8ToBase64 = (input: string) => {
  const bytes = new TextEncoder().encode(input);
  return base64Encode(bytes.buffer);
};

const encodeSubjectUtf8 = (subject: string) => {
  // RFC 2047 (encoded-word) using Base64
  return `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
};

const sendGmailEmail = async (params: {
  gmailUser: string;
  gmailPassword: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}) => {
  const { gmailUser, gmailPassword, to, subject, text, html } = params;

  const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 });
  const writer = conn.writable.getWriter();
  const reader = conn.readable.pipeThrough(new TextDecoderStream()).getReader();
  const encoder = new TextEncoder();

  let buffer = '';

  const readLine = async (): Promise<string> => {
    while (true) {
      const idx = buffer.indexOf('\r\n');
      if (idx >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        return line;
      }
      const { value, done } = await reader.read();
      if (done || value == null) throw new Error('SMTP connection closed');
      buffer += value;
    }
  };

  const readResponse = async (expectedCodes: number[]) => {
    let lastLine = '';
    while (true) {
      const line = await readLine();
      lastLine = line;
      // multiline replies have '-' after code
      if (line.length >= 4 && line[3] !== '-') break;
    }
    const code = parseInt(lastLine.slice(0, 3), 10);
    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP error ${code}: ${lastLine}`);
    }
  };

  const writeCmd = async (cmd: string) => {
    await writer.write(encoder.encode(cmd + '\r\n'));
  };

  const b64Line = (s: string) => utf8ToBase64(s);

  try {
    await readResponse([220]);

    await writeCmd(`EHLO localhost`);
    await readResponse([250]);

    // AUTH LOGIN
    await writeCmd('AUTH LOGIN');
    await readResponse([334]);
    await writeCmd(b64Line(gmailUser));
    await readResponse([334]);
    await writeCmd(b64Line(gmailPassword));
    await readResponse([235]);

    await writeCmd(`MAIL FROM:<${gmailUser}>`);
    await readResponse([250]);

    await writeCmd(`RCPT TO:<${to}>`);
    await readResponse([250, 251]);

    await writeCmd('DATA');
    await readResponse([354]);

    const boundary = `alt_${crypto.randomUUID().replace(/-/g, '')}`;

    const headers = [
      `From: <${gmailUser}>`,
      `To: <${to}>`,
      `Subject: ${encodeSubjectUtf8(subject)}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
    ].join('\r\n');

    const partText = [
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      utf8ToBase64(text),
      ``,
    ].join('\r\n');

    const partHtml = [
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      utf8ToBase64(html),
      ``,
      `--${boundary}--`,
      ``,
    ].join('\r\n');

    const data = headers + partText + partHtml;

    // End of DATA with <CRLF>.<CRLF>
    await writer.write(encoder.encode(data + '\r\n.\r\n'));
    await readResponse([250]);

    await writeCmd('QUIT');
    await readResponse([221]);
  } finally {
    try { await writer.close(); } catch (_) {}
    try { await reader.cancel(); } catch (_) {}
    try { conn.close(); } catch (_) {}
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse body only once
    const body = await req.json();
    const { clienteId, action, message, channel, attemptId, converted, isNewSale } = body;
    
    if (action === 'generate-message') {
      // Fetch client data
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();
      
      if (clienteError || !cliente) {
        return new Response(
          JSON.stringify({ error: 'Cliente não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Fetch AI config from billing_config
      const { data: aiConfigs } = await supabase
        .from('billing_config')
        .select('config_key, config_value')
        .in('config_key', [
          'recovery_ai_provider', 
          'recovery_ai_model', 
          'recovery_ai_prompt',
          'recovery_openai_api_key',
          'recovery_grok_api_key'
        ]);
      
      const configMap: Record<string, string> = {};
      aiConfigs?.forEach(c => { configMap[c.config_key] = c.config_value; });
      
      const aiProvider = configMap.recovery_ai_provider || 'lovable';
      const aiModel = configMap.recovery_ai_model || 'google/gemini-2.5-flash';
      const customPrompt = configMap.recovery_ai_prompt || '';
      const openaiApiKey = configMap.recovery_openai_api_key || '';
      const grokApiKey = configMap.recovery_grok_api_key || '';
      
      // Calculate days overdue
      const today = new Date();
      const renovacao = new Date(cliente.data_renovacao);
      const daysOverdue = Math.floor((today.getTime() - renovacao.getTime()) / (1000 * 60 * 60 * 24));
      
      // Build the prompt
      const baseInstructions = customPrompt || 'Você é um especialista em recuperação de clientes inadimplentes. Gere uma mensagem persuasiva e personalizada para recuperar o cliente.';
      
      const prompt = `${baseInstructions}

Dados do cliente (USE ESSES VALORES EXATOS na mensagem, NÃO use variáveis como [Produto] ou {nome}):
- Nome do cliente: ${cliente.nome}
- Nome do produto: ${cliente.produto}
- Plano: ${cliente.plano || 'Não especificado'}
- Valor: ${cliente.moeda === 'USD' ? '$' : 'R$'} ${cliente.valor}
- Email: ${cliente.email}
- Data de vencimento: ${new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
- Dias em atraso: ${daysOverdue}

IMPORTANTE - Instruções obrigatórias:
1. Use o NOME REAL do cliente na mensagem (ex: "Olá ${cliente.nome}")
2. Use o NOME REAL do produto na mensagem (ex: "sua assinatura do ${cliente.produto}")
3. NUNCA escreva [Produto], [Nome], {produto}, {nome} ou qualquer variável - use os valores reais acima
4. Seja cordial mas direto
5. Destaque os benefícios que o cliente pode estar perdendo
6. Ofereça ajuda para resolver qualquer problema
7. Crie senso de urgência sem ser agressivo
8. A mensagem deve ter no máximo 500 caracteres
9. Use emojis de forma moderada
10. NÃO inclua links de pagamento na mensagem

Responda APENAS com a mensagem pronta para enviar, sem explicações.`;

      // Fallback message
      const fallbackMessage = `Olá ${cliente.nome}! 👋

Notamos que sua assinatura do ${cliente.produto} está pendente há ${daysOverdue} dias.

Sabemos que imprevistos acontecem. Podemos ajudar?

Valor: ${cliente.moeda === 'USD' ? '$' : 'R$'} ${cliente.valor}

Entre em contato para regularizar e continuar aproveitando todos os benefícios! 🚀`;

      // If AI is disabled, return fallback
      if (aiProvider === 'none') {
        return new Response(
          JSON.stringify({ message: fallbackMessage, usedAI: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let aiResponse: Response | null = null;
      let usedProvider = aiProvider;

      try {
        if (aiProvider === 'lovable') {
          // Use Lovable AI Gateway
          if (!lovableApiKey) {
            throw new Error('LOVABLE_API_KEY not configured');
          }
          
          aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: prompt }],
            }),
          });
        } else if (aiProvider === 'openai') {
          // Use OpenAI directly
          if (!openaiApiKey) {
            throw new Error('OpenAI API key not configured');
          }
          
          aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: prompt }],
            }),
          });
        } else if (aiProvider === 'grok') {
          // Use Grok (xAI)
          if (!grokApiKey) {
            throw new Error('Grok API key not configured');
          }
          
          aiResponse = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${grokApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: prompt }],
            }),
          });
        }

        if (!aiResponse || !aiResponse.ok) {
          const errorText = aiResponse ? await aiResponse.text() : 'No response';
          console.error(`AI ${aiProvider} error:`, errorText);
          throw new Error(`AI error: ${errorText}`);
        }

        const aiData = await aiResponse.json();
        const generatedMessage = aiData.choices?.[0]?.message?.content || '';

        return new Response(
          JSON.stringify({ message: generatedMessage, usedAI: true, provider: usedProvider }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        console.error('AI generation error:', error.message);
        // Return fallback on error
        return new Response(
          JSON.stringify({ message: fallbackMessage, usedAI: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    if (action === 'generate-new-sale-message') {
      // Fetch client data for registro clients (new sale)
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();
      
      if (clienteError || !cliente) {
        return new Response(
          JSON.stringify({ error: 'Cliente não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch purchases for this client
      const { data: purchases } = await supabase
        .from('client_purchases')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_compra', { ascending: false })
        .limit(5);
      
      // Fetch AI config from billing_config
      const { data: aiConfigs } = await supabase
        .from('billing_config')
        .select('config_key, config_value')
        .in('config_key', [
          'recovery_ai_provider', 
          'recovery_ai_model', 
          'recovery_new_sale_prompt',
          'recovery_openai_api_key',
          'recovery_grok_api_key'
        ]);
      
      const configMap: Record<string, string> = {};
      aiConfigs?.forEach(c => { configMap[c.config_key] = c.config_value; });
      
      const aiProvider = configMap.recovery_ai_provider || 'lovable';
      const aiModel = configMap.recovery_ai_model || 'google/gemini-2.5-flash';
      const customPrompt = configMap.recovery_new_sale_prompt || '';
      const openaiApiKey = configMap.recovery_openai_api_key || '';
      const grokApiKey = configMap.recovery_grok_api_key || '';
      
      // Calculate days since last purchase
      const today = new Date();
      const lastPurchase = new Date(cliente.data_renovacao);
      const daysSincePurchase = Math.floor((today.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));

      // Build purchases list for context
      const purchasesList = purchases?.map(p => 
        `- ${p.produto}: ${p.moeda === 'USD' ? '$' : 'R$'} ${p.valor} em ${new Date(p.data_compra).toLocaleDateString('pt-BR')}`
      ).join('\n') || 'Nenhuma compra anterior registrada';
      
      // Build the prompt for new sale
      const baseInstructions = customPrompt || 'Você é um especialista em vendas. Gere uma mensagem persuasiva para oferecer novos produtos/serviços ao cliente com base no histórico de compras.';
      
      const prompt = `${baseInstructions}

Dados do cliente (USE ESSES VALORES EXATOS na mensagem, NÃO use variáveis como [Produto] ou {nome}):
- Nome do cliente: ${cliente.nome}
- Email: ${cliente.email}
- Último produto comprado: ${cliente.produto}
- Valor da última compra: ${cliente.moeda === 'USD' ? '$' : 'R$'} ${cliente.valor}
- Data da última compra: ${new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
- Dias desde a última compra: ${daysSincePurchase}

Histórico de compras:
${purchasesList}

IMPORTANTE - Instruções obrigatórias:
1. Use o NOME REAL do cliente na mensagem (ex: "Olá ${cliente.nome}")
2. Use o NOME REAL do produto na mensagem (ex: "você adquiriu o ${cliente.produto}")
3. NUNCA escreva [Produto], [Nome], {produto}, {nome} ou qualquer variável - use os valores reais acima
4. Seja cordial e profissional
5. Mencione que você notou o interesse anterior no produto
6. Sugira produtos/serviços complementares ou upgrades
7. Destaque os benefícios e novidades
8. Crie interesse sem ser insistente
9. A mensagem deve ter no máximo 500 caracteres
10. Use emojis de forma moderada
11. NÃO inclua links ou preços específicos na mensagem
12. Pergunte se há interesse em saber mais

Responda APENAS com a mensagem pronta para enviar, sem explicações.`;

      // Fallback message for new sale
      const fallbackMessage = `Olá ${cliente.nome}! 👋

Tudo bem? Vi que você adquiriu o ${cliente.produto} há ${daysSincePurchase} dias.

Estamos com novidades que podem te interessar! 🚀

Gostaria de saber mais sobre nossos outros produtos e serviços?

Aguardo seu retorno! 😊`;

      // If AI is disabled, return fallback
      if (aiProvider === 'none') {
        return new Response(
          JSON.stringify({ message: fallbackMessage, usedAI: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let aiResponse: Response | null = null;
      let usedProvider = aiProvider;

      try {
        if (aiProvider === 'lovable') {
          const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
          if (!lovableApiKey) {
            throw new Error('LOVABLE_API_KEY not configured');
          }
          
          aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: prompt }],
            }),
          });
        } else if (aiProvider === 'openai') {
          if (!openaiApiKey) {
            throw new Error('OpenAI API key not configured');
          }
          
          aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: prompt }],
            }),
          });
        } else if (aiProvider === 'grok') {
          if (!grokApiKey) {
            throw new Error('Grok API key not configured');
          }
          
          aiResponse = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${grokApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [{ role: "user", content: prompt }],
            }),
          });
        }

        if (!aiResponse || !aiResponse.ok) {
          const errorText = aiResponse ? await aiResponse.text() : 'No response';
          console.error(`AI ${aiProvider} error:`, errorText);
          throw new Error(`AI error: ${errorText}`);
        }

        const aiData = await aiResponse.json();
        const generatedMessage = aiData.choices?.[0]?.message?.content || '';

        return new Response(
          JSON.stringify({ message: generatedMessage, usedAI: true, provider: usedProvider }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        console.error('AI generation error:', error.message);
        return new Response(
          JSON.stringify({ message: fallbackMessage, usedAI: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    if (action === 'send-recovery') {
      // message and channel already extracted from body above
      
      // Fetch client data
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();
      
      if (clienteError || !cliente) {
        return new Response(
          JSON.stringify({ error: 'Cliente não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      let sendStatus = 'sent';
      let errorMessage = null;
      
      if (channel === 'whatsapp') {
        // Get active WhatsApp instance
        const { data: instance } = await supabase
          .from('billing_whatsapp_instances')
          .select('*')
          .eq('is_active', true)
          .limit(1)
          .single();
        
        if (instance) {
          try {
            // Format phone number
            let phone = cliente.numero.replace(/\D/g, '');
            // Only prepend 55 if it looks like a local Brazilian number without country code
            // (10 or 11 digits and doesn't start with '55' or '1')
            if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith('55') && !phone.startsWith('1')) {
              phone = '55' + phone;
            }
            
            const response = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': instance.api_key,
              },
              body: JSON.stringify({
                number: phone,
                text: message,
              }),
            });
            
            const responseData = await response.json().catch(() => null);
            
            if (!response.ok) {
              // Detectar se o número não existe no WhatsApp
              const errorText = JSON.stringify(responseData) || 'Unknown error';
              if (errorText.toLowerCase().includes('not registered') || 
                  errorText.toLowerCase().includes('not on whatsapp') ||
                  errorText.toLowerCase().includes('número não existe') ||
                  errorText.toLowerCase().includes('not found') ||
                  responseData?.error?.includes('not registered')) {
                throw new Error('Número não existe no WhatsApp');
              }
              throw new Error(`WhatsApp API error: ${errorText}`);
            }
            
            // Verificar se a resposta indica que o número não existe
            if (responseData?.error || responseData?.status === 'error') {
              const errMsg = responseData?.error || responseData?.message || 'Erro desconhecido';
              if (errMsg.toLowerCase().includes('not registered') || 
                  errMsg.toLowerCase().includes('not on whatsapp') ||
                  errMsg.toLowerCase().includes('not found')) {
                throw new Error('Número não existe no WhatsApp');
              }
              throw new Error(errMsg);
            }
          } catch (error: any) {
            sendStatus = 'error';
            errorMessage = error.message;
          }
        } else {
          sendStatus = 'error';
          errorMessage = 'Nenhuma instância WhatsApp ativa';
        }
      } else if (channel === 'email') {
        // Buscar credenciais Gmail da aba Canais (billing_config) - mesmo lugar usado pela cobrança
        const { data: configs } = await supabase
          .from('billing_config')
          .select('config_key, config_value')
          .in('config_key', ['billing_gmail_user', 'billing_gmail_password']);

        const gmailUser = configs?.find(c => c.config_key === 'billing_gmail_user')?.config_value;
        const gmailPassword = configs?.find(c => c.config_key === 'billing_gmail_password')?.config_value;

        if (gmailUser && gmailPassword) {
          try {
            if (!cliente.email) {
              throw new Error('Cliente sem email cadastrado');
            }

            const htmlMessage = String(message || '').replace(/\n/g, '<br/>');

            const emailSubject = isNewSale
              ? `${cliente.produto || 'Produto'} - ${cliente.nome}`
              : `Recuperação - ${cliente.produto || 'Assinatura'} - ${cliente.nome}`;

            await sendGmailEmail({
              gmailUser,
              gmailPassword,
              to: cliente.email,
              subject: emailSubject,
              text: String(message || ''),
              html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body>
  <div style="font-family: Arial, sans-serif; line-height: 1.5">
    <p>${htmlMessage}</p>
  </div>
</body>
</html>`,
            });

            sendStatus = 'sent';
          } catch (error: any) {
            sendStatus = 'error';
            errorMessage = error.message;
          }
        } else {
          sendStatus = 'error';
          errorMessage = 'Credenciais Gmail não configuradas em Canais';
        }
      }

      // Log the recovery attempt with error details if any
      const { data: attemptData, error: logError } = await supabase
        .from('client_recovery_attempts')
        .insert({
          cliente_id: clienteId,
          data_vencimento: cliente.data_renovacao,
          mensagem_enviada: message,
          canal: channel,
          status: sendStatus,
          error_message: errorMessage,
        })
        .select('id')
        .single();
      
      if (logError) {
        console.error('Error logging recovery attempt:', logError);
      }

      // Disparar webhooks se o envio foi bem-sucedido
      if (sendStatus === 'sent') {
        const evento = isNewSale ? 'recovery.registro' : 'recovery.inadimplente';
        const contactInfo = channel === 'whatsapp' ? cliente.numero : cliente.email;

        const payload = {
          evento,
          tipo: isNewSale ? 'Cliente Registro' : 'Inadimplente',
          cliente: {
            nome: cliente.nome,
            produto: cliente.produto,
          },
          canal: channel === 'whatsapp' ? 'WhatsApp' : 'Email',
          contato: contactInfo,
          mensagem_enviada: message,
          enviado_em: new Date().toISOString(),
        };

        try {
          const { data: webhooks } = await supabase
            .from('client_recovery_webhooks')
            .select('*')
            .eq('is_active', true)
            .contains('eventos', [evento]);

          for (const webhook of webhooks || []) {
            let whStatus = 0;
            let whBody = '';
            let whSuccess = false;
            try {
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (webhook.secret_key) {
                headers['X-Webhook-Secret'] = webhook.secret_key;
              }
              const whResp = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
              });
              whStatus = whResp.status;
              whBody = await whResp.text().catch(() => '');
              whSuccess = whResp.ok;
            } catch (e: any) {
              whBody = e.message;
            }

            // Log
            await supabase.from('client_recovery_webhook_logs').insert({
              webhook_id: webhook.id,
              attempt_id: attemptData?.id || null,
              evento,
              payload,
              response_status: whStatus || null,
              response_body: whBody,
              success: whSuccess,
            });

            // Update last_triggered_at
            if (whSuccess) {
              await supabase
                .from('client_recovery_webhooks')
                .update({ last_triggered_at: new Date().toISOString() })
                .eq('id', webhook.id);
            }
          }
        } catch (e: any) {
          console.error('Webhook dispatch error:', e.message);
        }

        // === BASEROW: Create/update lead (apenas WhatsApp) ===
        if (channel === 'whatsapp') {
          await createBaserowLead(supabaseUrl, evento, cliente.nome, cliente.numero);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: sendStatus === 'sent',
          status: sendStatus,
          error: errorMessage 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action === 'get-history') {
      const { data: history, error } = await supabase
        .from('client_recovery_attempts')
        .select(`
          *,
          clientes:cliente_id (nome, produto, numero, email)
        `)
        .order('data_envio', { ascending: false })
        .limit(100);
      
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ history }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action === 'mark-converted') {
      // attemptId and converted already extracted from body above
      
      const { error } = await supabase
        .from('client_recovery_attempts')
        .update({ converteu: converted })
        .eq('id', attemptId);
      
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==================== WEBHOOK CRUD ====================
    if (action === 'list-webhooks') {
      const { data, error } = await supabase
        .from('client_recovery_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ webhooks: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'create-webhook') {
      const { nome, url: whUrl, secret_key, eventos } = body;
      const { data, error } = await supabase
        .from('client_recovery_webhooks')
        .insert({ nome, url: whUrl, secret_key: secret_key || null, eventos: eventos || ['recovery.inadimplente', 'recovery.registro'] })
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ webhook: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update-webhook') {
      const { webhookId, nome, url: whUrl, secret_key, eventos, is_active } = body;
      const { data, error } = await supabase
        .from('client_recovery_webhooks')
        .update({ nome, url: whUrl, secret_key: secret_key || null, eventos, is_active })
        .eq('id', webhookId)
        .select()
        .single();
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ webhook: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete-webhook') {
      const { webhookId } = body;
      const { error } = await supabase.from('client_recovery_webhooks').delete().eq('id', webhookId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list-webhook-logs') {
      const { webhookId } = body;
      const query = supabase
        .from('client_recovery_webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (webhookId) query.eq('webhook_id', webhookId);
      const { data, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ logs: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Client recovery error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function createBaserowLead(
  supabaseUrl: string,
  event: string,
  clientName: string,
  clientPhone: string | null,
) {
  if (!clientPhone) return;

  try {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || '';
    const payload = {
      module: 'recovery',
      event,
      lead_name: clientName,
      lead_phone: clientPhone,
      lead_date: new Date().toLocaleDateString('pt-BR'),
    };

    console.log(`📦 [client-recovery] sending to Baserow: ${JSON.stringify(payload)}`);

    const resp = await fetch(`${supabaseUrl}/functions/v1/baserow-create-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.text();
    if (!resp.ok) {
      console.error(`❌ [client-recovery] Baserow HTTP error (recovery/${event}): ${resp.status} - ${result}`);
      return;
    }

    console.log(`✅ [client-recovery] Baserow response (recovery/${event}): ${result}`);
  } catch (err: any) {
    console.error(`❌ Baserow lead creation error:`, err.message);
  }
}
