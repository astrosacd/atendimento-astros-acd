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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
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
    let userPrompt: any = "";

    if (action === "generate_full_proposal") {
      systemPrompt = `Você é um especialista em estruturação de propostas comerciais.
Seu objetivo é analisar as instruções do usuário (em áudio ou texto) e retornar um JSON estruturado com as seções recomendadas para compor a proposta completa.

Você deve retornar APENAS um JSON no seguinte formato:
{
  "title": "Título sugerido para a proposta",
  "sections": [
    {
      "type": "cover" | "text" | "pricing" | "timeline" | "terms" | "gallery",
      "title": "Título da seção",
      "content": { 
        // Conteúdo formatado para o tipo de seção:
        // cover: { title, subtitle }
        // text: { content: "Markdown text" }
        // pricing: { items: [{ description, quantity, unitPrice }] }
        // timeline: { items: [{ phase, duration, description }] }
        // terms: { content: "Markdown text" }
      }
    }
  ]
}

Regras:
- Seja profissional e persuasivo.
- Extraia nomes de clientes, valores e prazos se mencionados.
- Se for áudio, ignore ruídos.
- Retorne APENAS o JSON, sem explicações.`;

      userPrompt = [
        {
          type: "text",
          text: `Crie uma proposta completa baseada nestas instruções: ${fullProposalRequest || "Siga o áudio anexo."}`
        }
      ];

      if (audioData) {
        userPrompt.push({
          type: "media_url",
          media_url: {
            url: `data:audio/webm;base64,${audioData}`
          }
        });
      }
    } else if (action === "transcribe_and_generate") {
      systemPrompt = `Você é um assistente especializado em criar propostas comerciais.
Seu objetivo é ouvir o áudio do usuário (fornecido como dados base64) e extrair as informações necessárias para preencher uma seção específica de uma proposta comercial.

Regras:
- Transforme o que o usuário falou em um texto profissional, persuasivo e bem estruturado.
- Se for uma seção de 'texto', crie parágrafos atraentes.
- Se for uma 'capa', crie um título e subtítulo profissionais.
- Se for 'termos', formalize as condições mencionadas.
- Ignore ruídos e hesitações, foque no conteúdo útil.
- Responda apenas com o texto final da seção, sem comentários adicionais.`;

      userPrompt = [
        {
          type: "text",
          text: `Abaixo está um áudio onde o usuário descreve o que quer na seção "${sectionType}" da proposta.
Por favor, gere o conteúdo final para esta seção com base no que foi dito.

${context ? `Contexto adicional da proposta: ${context}` : ""}
${currentContent ? `Conteúdo atual (que pode ser substituído ou complementado): ${currentContent}` : ""}`
        },
        {
          type: "media_url",
          media_url: {
            url: `data:audio/webm;base64,${audioData}`
          }
        }
      ];
    } else if (action === "generate") {
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

    console.log(`Chamando AI Gateway com action: ${action}`);
    
    // Simplificar prompt se não houver audioData
    let finalUserPrompt = userPrompt;
    if (action === "generate_full_proposal" && !audioData && Array.isArray(userPrompt)) {
      finalUserPrompt = userPrompt[0].text;
    }

    const aiResponse = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash", // Corrigido para 2.0 que é estável no gateway
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: finalUserPrompt },
        ],
        max_tokens: 2500,
        response_format: action === "generate_full_proposal" ? { type: "json_object" } : undefined,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao comunicar com IA" }),
        { status: aiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResponse.json();
    const generatedText = data.choices?.[0]?.message?.content || "";

    // Se for geração de proposta completa, tentar retornar o objeto JSON diretamente
    if (action === "generate_full_proposal") {
      try {
        const parsed = JSON.parse(generatedText);
        return new Response(
          JSON.stringify(parsed),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("Erro ao fazer parse do JSON da IA:", e);
      }
    }

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
