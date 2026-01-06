import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { clienteId, action, message, channel, attemptId, converted } = body;
    
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
      
      // Calculate days overdue
      const today = new Date();
      const renovacao = new Date(cliente.data_renovacao);
      const daysOverdue = Math.floor((today.getTime() - renovacao.getTime()) / (1000 * 60 * 60 * 24));
      
      // Generate message with AI
      const prompt = `Você é um especialista em recuperação de clientes inadimplentes. Gere uma mensagem persuasiva e personalizada para recuperar o cliente.

Dados do cliente:
- Nome: ${cliente.nome}
- Produto: ${cliente.produto}
- Plano: ${cliente.plano || 'Não especificado'}
- Valor: ${cliente.moeda === 'USD' ? '$' : 'R$'} ${cliente.valor}
- Data de vencimento: ${new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
- Dias em atraso: ${daysOverdue}

Instruções:
1. Seja cordial mas direto
2. Mencione o produto/serviço pelo nome
3. Destaque os benefícios que o cliente pode estar perdendo
4. Ofereça ajuda para resolver qualquer problema
5. Crie senso de urgência sem ser agressivo
6. A mensagem deve ter no máximo 500 caracteres
7. Use emojis de forma moderada
8. NÃO inclua links de pagamento na mensagem

Responda APENAS com a mensagem, sem explicações adicionais.`;

      if (!lovableApiKey) {
        // Fallback message if no AI
        const fallbackMessage = `Olá ${cliente.nome}! 👋

Notamos que sua assinatura do ${cliente.produto} está pendente há ${daysOverdue} dias.

Sabemos que imprevistos acontecem. Podemos ajudar?

Valor: ${cliente.moeda === 'USD' ? '$' : 'R$'} ${cliente.valor}

Entre em contato para regularizar e continuar aproveitando todos os benefícios! 🚀`;

        return new Response(
          JSON.stringify({ message: fallbackMessage, usedAI: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI gateway error:", aiResponse.status);
        // Fallback message
        const fallbackMessage = `Olá ${cliente.nome}! 👋

Notamos que sua assinatura do ${cliente.produto} está pendente há ${daysOverdue} dias.

Valor: ${cliente.moeda === 'USD' ? '$' : 'R$'} ${cliente.valor}

Podemos ajudar a regularizar? Entre em contato! 🚀`;

        return new Response(
          JSON.stringify({ message: fallbackMessage, usedAI: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await aiResponse.json();
      const generatedMessage = aiData.choices?.[0]?.message?.content || '';

      return new Response(
        JSON.stringify({ message: generatedMessage, usedAI: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
            if (!phone.startsWith('55')) {
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
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`WhatsApp API error: ${errorText}`);
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
        // Envio via Gmail SMTP (usa secrets do projeto)
        const gmailUser = Deno.env.get('GMAIL_USER');
        const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

        if (gmailUser && gmailAppPassword) {
          try {
            if (!cliente.email) {
              throw new Error('Cliente sem email cadastrado');
            }

            const client = new SMTPClient({
              connection: {
                hostname: "smtp.gmail.com",
                port: 465,
                tls: true,
                auth: {
                  username: gmailUser,
                  password: gmailAppPassword,
                },
              },
            });

            const htmlMessage = String(message || '').replace(/\n/g, '<br/>');

            await client.send({
              from: gmailUser,
              to: cliente.email,
              subject: `Cobrança - ${cliente.produto || 'Assinatura'} (${cliente.nome})`,
              content: message,
              html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5">
                  <p>${htmlMessage}</p>
                </div>
              `.trim(),
            });

            await client.close();
            sendStatus = 'sent';
          } catch (error: any) {
            sendStatus = 'error';
            errorMessage = error.message;
          }
        } else {
          sendStatus = 'error';
          errorMessage = 'Credenciais Gmail não configuradas (GMAIL_USER / GMAIL_APP_PASSWORD)';
        }
      }

      // Log the recovery attempt
      const { error: logError } = await supabase
        .from('client_recovery_attempts')
        .insert({
          cliente_id: clienteId,
          data_vencimento: cliente.data_renovacao,
          mensagem_enviada: message,
          canal: channel,
          status: sendStatus,
        });
      
      if (logError) {
        console.error('Error logging recovery attempt:', logError);
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
