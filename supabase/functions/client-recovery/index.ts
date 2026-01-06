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

Dados do cliente:
- Nome: ${cliente.nome}
- Último produto comprado: ${cliente.produto}
- Valor da última compra: ${cliente.moeda === 'USD' ? '$' : 'R$'} ${cliente.valor}
- Data da última compra: ${new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
- Dias desde a última compra: ${daysSincePurchase}

Histórico de compras:
${purchasesList}

Instruções:
1. Seja cordial e profissional
2. Mencione que você notou o interesse anterior no produto
3. Sugira produtos/serviços complementares ou upgrades
4. Destaque os benefícios e novidades
5. Crie interesse sem ser insistente
6. A mensagem deve ter no máximo 500 caracteres
7. Use emojis de forma moderada
8. NÃO inclua links ou preços específicos na mensagem
9. Pergunte se há interesse em saber mais

Responda APENAS com a mensagem, sem explicações adicionais.`;

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

            const client = new SMTPClient({
              connection: {
                hostname: "smtp.gmail.com",
                port: 465,
                tls: true,
                auth: {
                  username: gmailUser,
                  password: gmailPassword,
                },
              },
            });

            const htmlMessage = String(message || '').replace(/\n/g, '<br/>');

            await client.send({
              from: gmailUser,
              to: cliente.email,
              subject: `Recuperação - ${cliente.produto || 'Assinatura'} (${cliente.nome})`,
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
          errorMessage = 'Credenciais Gmail não configuradas em Canais';
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
