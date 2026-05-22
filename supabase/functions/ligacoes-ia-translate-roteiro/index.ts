// Translates an existing roteiro (script) to another language using Lovable AI Gateway.
// Returns translated nome + texto. Variables {nome}, {valor}, {produto}, {data_renovacao}
// must be preserved literally.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const IDIOMA_LABEL: Record<string, string> = {
  "pt-BR": "Brazilian Portuguese",
  "en-US": "American English",
  "es-ES": "European Spanish",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { nome, texto, source_idioma = "pt-BR", target_idioma } = await req.json();
    if (!texto || !target_idioma) {
      return new Response(JSON.stringify({ error: "Faltam parâmetros: texto e target_idioma" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!IDIOMA_LABEL[target_idioma]) {
      return new Response(JSON.stringify({ error: `Idioma alvo inválido: ${target_idioma}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente no servidor" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a professional translator specialized in customer-facing phone scripts for billing/renewal calls.
Translate the user's script from ${IDIOMA_LABEL[source_idioma] ?? source_idioma} to ${IDIOMA_LABEL[target_idioma]}.

CRITICAL RULES:
1. Preserve ALL placeholders exactly as-is: {nome}, {valor}, {produto}, {data_renovacao}. Never translate the words inside braces, never change capitalization, never remove braces.
2. Keep the tone professional, warm and concise — suitable for being spoken aloud by a TTS voice on a phone call.
3. Do NOT add disclaimers, do NOT explain, do NOT include quotes around the output.
4. Output ONLY the translated text and (optionally) translated title — nothing else.`;

    const userPrompt = `Translate this script.

${nome ? `TITLE: ${nome}\n\n` : ""}SCRIPT:
${texto}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_translation",
            description: "Return the translated title and script text.",
            parameters: {
              type: "object",
              properties: {
                nome_traduzido: { type: "string", description: "Translated title (may be original if no title provided)." },
                texto_traduzido: { type: "string", description: "Translated script preserving all {placeholders}." },
              },
              required: ["texto_traduzido"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_translation" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos do Lovable AI esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await resp.text();
      console.error("AI gateway error", resp.status, errText);
      return new Response(JSON.stringify({ error: `Falha ao traduzir (status ${resp.status})` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = null;
    if (toolCall?.function?.arguments) {
      try { parsed = JSON.parse(toolCall.function.arguments); } catch { /* noop */ }
    }
    if (!parsed?.texto_traduzido) {
      console.error("No translation returned", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "IA não retornou tradução válida" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      nome_traduzido: parsed.nome_traduzido ?? nome ?? "",
      texto_traduzido: parsed.texto_traduzido,
      target_idioma,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("translate-roteiro error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
