import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, context, currentContent, sectionType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "generate") {
      systemPrompt = `Você é um especialista em propostas comerciais. Seu objetivo é gerar textos profissionais, persuasivos e objetivos para propostas comerciais.

Regras:
- Seja direto e profissional
- Use linguagem adequada para negócios B2B
- Estruture o texto de forma clara com parágrafos curtos
- Evite jargões excessivos
- Foque em benefícios e valor para o cliente
- Responda apenas com o texto, sem explicações adicionais`;

      const sectionContexts: Record<string, string> = {
        text: "um parágrafo de texto descritivo",
        cover: "título e subtítulo impactantes",
        terms: "termos e condições comerciais",
      };

      userPrompt = `Gere ${sectionContexts[sectionType] || "conteúdo"} para uma proposta comercial.

${context ? `Contexto adicional: ${context}` : ""}
${currentContent ? `Conteúdo atual para melhorar: ${currentContent}` : ""}

Gere um texto profissional e persuasivo.`;
    } else if (action === "improve") {
      systemPrompt = `Você é um especialista em redação comercial. Seu objetivo é melhorar textos existentes tornando-os mais profissionais, persuasivos e impactantes.

Regras:
- Mantenha a essência do texto original
- Torne mais claro e objetivo
- Adicione elementos persuasivos
- Corrija erros gramaticais
- Responda apenas com o texto melhorado, sem explicações`;

      userPrompt = `Melhore este texto de proposta comercial:

"${currentContent}"

${context ? `Contexto: ${context}` : ""}`;
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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Erro ao comunicar com IA");
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ text: generatedText.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Proposal AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
