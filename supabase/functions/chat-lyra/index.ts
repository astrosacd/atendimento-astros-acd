import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const defaultSystemPrompt = `Você é a Lyra, uma assistente virtual da Astros Comunicação Digital. 
Você é amigável, profissional e sempre disposta a ajudar.

Sobre o sistema:
- Este é um sistema de cadastro e gerenciamento de clientes
- Funcionalidades: Cadastrar, Consultar, Atualizar e Excluir clientes
- Campos dos clientes: Nome, Número WhatsApp, Produto, Data de Renovação, Email, CPF/CNPJ, Plano e Valor

Instruções:
- Responda sempre em português brasileiro
- Seja concisa mas útil
- Se não souber a resposta, indique que o usuário pode entrar em contato com o suporte
- Mantenha um tom amigável e profissional`;

interface AIConfig {
  provider: string;
  model: string;
  systemPrompt: string;
  openaiApiKey?: string;
  groqApiKey?: string;
}

async function callLovableAI(messages: any[], config: AIConfig): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...messages,
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 402) {
      throw new Error("PAYMENT_REQUIRED");
    }
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    throw new Error("Erro ao processar mensagem");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

async function callOpenAI(messages: any[], config: AIConfig): Promise<string> {
  if (!config.openaiApiKey) {
    throw new Error("OpenAI API Key não configurada. Configure a chave no painel de administração.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 401) {
      throw new Error("API Key da OpenAI inválida. Verifique a configuração.");
    }
    if (response.status === 402 || response.status === 403) {
      throw new Error("Limite de uso da OpenAI atingido ou acesso negado.");
    }
    const errorText = await response.text();
    console.error("OpenAI error:", response.status, errorText);
    throw new Error("Erro ao processar mensagem com OpenAI");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

async function callGroq(messages: any[], config: AIConfig): Promise<string> {
  if (!config.groqApiKey) {
    throw new Error("Groq API Key não configurada. Configure a chave no painel de administração.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 401) {
      throw new Error("API Key da Groq inválida. Verifique a configuração.");
    }
    const errorText = await response.text();
    console.error("Groq error:", response.status, errorText);
    throw new Error("Erro ao processar mensagem com Groq");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Default configuration
    const aiConfig: AIConfig = {
      provider: 'lovable',
      model: 'google/gemini-2.5-flash',
      systemPrompt: defaultSystemPrompt,
    };
    
    let supabase: any = null;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { data: configData } = await supabase
          .from('billing_config')
          .select('config_key, config_value')
          .in('config_key', [
            'chat_ai_prompt', 
            'chat_ai_model', 
            'chat_ai_provider',
            'chat_openai_api_key',
            'chat_groq_api_key'
          ]);
        
        if (configData) {
          for (const item of configData) {
            if (item.config_key === 'chat_ai_prompt' && item.config_value) {
              aiConfig.systemPrompt = item.config_value;
            }
            if (item.config_key === 'chat_ai_model' && item.config_value) {
              aiConfig.model = item.config_value;
            }
            if (item.config_key === 'chat_ai_provider' && item.config_value) {
              aiConfig.provider = item.config_value;
            }
            if (item.config_key === 'chat_openai_api_key' && item.config_value) {
              aiConfig.openaiApiKey = item.config_value;
            }
            if (item.config_key === 'chat_groq_api_key' && item.config_value) {
              aiConfig.groqApiKey = item.config_value;
            }
          }
        }
      } catch (dbError) {
        console.error("Error fetching config:", dbError);
      }
    }

    console.log("Using AI provider:", aiConfig.provider, "model:", aiConfig.model);

    // Call the appropriate AI provider
    let assistantResponse: string;
    
    try {
      switch (aiConfig.provider) {
        case 'openai':
          assistantResponse = await callOpenAI(messages, aiConfig);
          break;
        case 'groq':
          assistantResponse = await callGroq(messages, aiConfig);
          break;
        case 'lovable':
        default:
          assistantResponse = await callLovableAI(messages, aiConfig);
          break;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "RATE_LIMIT") {
          return new Response(
            JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        if (error.message === "PAYMENT_REQUIRED") {
          return new Response(
            JSON.stringify({ error: "Limite de uso atingido. Entre em contato com o suporte." }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        // Return other errors as user-friendly messages
        return new Response(
          JSON.stringify({ 
            error: error.message,
            response: error.message 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // Save messages to database if conversationId and userId provided
    if (supabase && conversationId && userId) {
      try {
        // Get the last user message
        const lastUserMessage = messages[messages.length - 1];
        
        // Save user message
        if (lastUserMessage) {
          await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: lastUserMessage.content,
          });
        }
        
        // Save assistant message
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantResponse,
        });

        // Update conversation title if it's the first message
        const { data: msgCount } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact' })
          .eq('conversation_id', conversationId);
        
        if (msgCount && msgCount.length <= 2 && lastUserMessage) {
          // Generate a title from the first message
          const title = lastUserMessage.content.slice(0, 50) + (lastUserMessage.content.length > 50 ? '...' : '');
          await supabase
            .from('chat_conversations')
            .update({ title })
            .eq('id', conversationId);
        }
      } catch (saveError) {
        console.error("Error saving messages:", saveError);
        // Don't fail the request if saving fails
      }
    }

    return new Response(
      JSON.stringify({ response: assistantResponse, model: aiConfig.model, provider: aiConfig.provider }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        response: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
