import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, context, currentContent, sectionType, fullProposalRequest } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY não encontrada");
      throw new Error("Configuração de IA ausente");
    }

    let systemPrompt = "";
    let userPromptContent = "";

    if (action === "generate_full_proposal") {
      systemPrompt = `Você é um especialista em estruturação de propostas comerciais.
Retorne APENAS um JSON estruturado.
O JSON deve seguir este formato EXATO:
{
  "title": "Título da Proposta",
  "sections": [
    {
      "type": "cover",
      "title": "Capa",
      "content": { "title": "...", "subtitle": "..." }
    },
    {
      "type": "text",
      "title": "Apresentação",
      "content": { "content": "Markdown text" }
    },
    {
      "type": "pricing",
      "title": "Investimento",
      "content": { "items": [{ "description": "Item", "quantity": 1, "unitPrice": 1000 }] }
    }
  ]
}

Regras:
- Tipos válidos: cover, text, pricing, timeline, terms, gallery.
- Use PT-BR.
- Retorne apenas o JSON.`;

      userPromptContent = `Instruções do cliente: ${fullProposalRequest || context || "Gere uma proposta comercial genérica e profissional."}`;
    } else {
      systemPrompt = "Você é um especialista em redação de propostas comerciais. Gere ou melhore o conteúdo solicitado de forma profissional e persuasiva.";
      userPromptContent = `Ação: ${action}
Tipo de Seção: ${sectionType || 'geral'}
Conteúdo Atual: ${currentContent || 'vazio'}
Instruções: ${context || fullProposalRequest || 'gerar conteúdo profissional'}

Retorne apenas o texto final em Markdown.`;
    }

    console.log("Chamando AI Gateway...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini", 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPromptContent },
        ],
        response_format: action === "generate_full_proposal" ? { type: "json_object" } : { type: "text" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Erro na API da OpenAI/Gateway:", response.status, errorData);
      throw new Error(`Falha na IA (${response.status}): ${errorData}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    console.log("Conteúdo gerado com sucesso");

    if (action === "generate_full_proposal") {
      return new Response(content, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: content.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro geral na function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
