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
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, context, currentContent, sectionType, audioData, fullProposalRequest } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    let systemPrompt = "";
    let userPromptContent: any = "";

    if (action === "generate_full_proposal") {
      systemPrompt = `Você é um especialista em estruturação de propostas comerciais.
Seu objetivo é analisar as instruções do usuário e retornar um JSON estruturado com as seções recomendadas para compor a proposta completa.

Você deve retornar APENAS um JSON no seguinte formato:
{
  "title": "Título sugerido para a proposta",
  "sections": [
    {
      "type": "cover",
      "title": "Capa",
      "content": { "title": "...", "subtitle": "..." }
    },
    {
      "type": "text",
      "title": "Sobre Nós",
      "content": { "content": "Markdown text" }
    },
    {
      "type": "pricing",
      "title": "Investimento",
      "content": { "items": [{ "description": "...", "quantity": 1, "unitPrice": 1000 }] }
    }
  ]
}

Regras:
- Tipos de seção válidos: cover, text, pricing, timeline, terms, gallery.
- Seja profissional e persuasivo.
- Retorne APENAS o JSON, sem explicações.`;

      userPromptContent = `Crie uma proposta completa baseada nestas instruções: ${fullProposalRequest || context || "Crie uma proposta comercial padrão."}`;
    } else if (action === "generate" || action === "improve") {
      systemPrompt = action === "improve" 
        ? "Você é um especialista em redação comercial. Melhore o texto para ser mais profissional e persuasivo."
        : "Você é um especialista em propostas comerciais. Gere um texto profissional e persuasivo para a seção solicitada.";

      userPromptContent = `${action === "improve" ? "Melhore este texto" : "Gere conteúdo para a seção " + sectionType}:
      
      Conteúdo Atual: ${currentContent || "Nenhum"}
      Contexto/Instruções: ${context || fullProposalRequest || "Nenhum"}
      
      Retorne apenas o texto final.`;
    } else {
      // Fallback para outros casos
      systemPrompt = "Você é um assistente útil para criação de propostas.";
      userPromptContent = context || fullProposalRequest || "Ajude-me a criar uma proposta.";
    }

    console.log(`Chamando AI Gateway com action: ${action}`);
    
    const aiResponse = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Usando gpt-4o-mini que é muito estável e suporta JSON mode
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPromptContent },
        ],
        max_tokens: 2500,
        response_format: action === "generate_full_proposal" ? { type: "json_object" } : undefined,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`Erro na IA (${aiResponse.status}): ${errorText}`);
    }

    const data = await aiResponse.json();
    const generatedContent = data.choices?.[0]?.message?.content || "";

    if (action === "generate_full_proposal") {
      try {
        const parsed = JSON.parse(generatedContent);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e) {
        console.error("Erro ao fazer parse do JSON da IA:", e, generatedContent);
        throw new Error("A IA não retornou um formato válido. Tente ser mais específico.");
      }
    }

    return new Response(
      JSON.stringify({ text: generatedContent.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Proposal AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno no servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
