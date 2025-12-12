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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch custom prompt from database
    let systemPrompt = defaultSystemPrompt;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data } = await supabase
          .from('billing_config')
          .select('config_value')
          .eq('config_key', 'chat_ai_prompt')
          .maybeSingle();
        
        if (data?.config_value) {
          systemPrompt = data.config_value;
        }
      } catch (dbError) {
        console.error("Error fetching custom prompt:", dbError);
        // Continue with default prompt
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Limite de uso atingido. Entre em contato com o suporte." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao processar mensagem");
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";

    return new Response(
      JSON.stringify({ response: assistantResponse }),
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
