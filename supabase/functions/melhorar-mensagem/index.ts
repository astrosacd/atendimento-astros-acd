import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { draft, tone = "amigavel", style = "whatsapp", keep_meaning = true, extra_instructions = "" } = await req.json();

    if (!draft || typeof draft !== "string" || draft.trim().length < 3 || draft.length > 4000) {
      return new Response(
        JSON.stringify({ error: "Mensagem inválida (mínimo 3 e máximo 4000 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reuse provider config (same as central-ajuda)
    const { data: providerConfig } = await supabase
      .from("followup_config")
      .select("config_key, config_value")
      .in("config_key", ["ai_provider", "ai_model", "ai_api_key_openai", "ai_api_key_groq"]);

    const getVal = (key: string, fallback: string) =>
      providerConfig?.find((c: any) => c.config_key === key)?.config_value || fallback;

    const aiProvider = getVal("ai_provider", "lovable");
    const aiModel = getVal("ai_model", "");
    const openaiKey = getVal("ai_api_key_openai", "");
    const groqKey = getVal("ai_api_key_groq", "");

    const toneLabel = tone === "formal"
      ? "formal e corporativo"
      : tone === "tecnico"
      ? "técnico e objetivo"
      : tone === "vendedor"
      ? "persuasivo e consultivo (vendas)"
      : "amigável e profissional";

    const styleLabel = style === "email"
      ? "e-mail (parágrafos curtos, sem formatação de WhatsApp)"
      : style === "plano"
      ? "texto plano (sem emojis, sem negrito)"
      : "WhatsApp (use *negrito*, ✅/⚠️/📌 com moderação, quebras de linha para legibilidade)";

    const systemPrompt = `Você é um redator especialista em comunicação com cliente.

SUA MISSÃO:
Receber um RASCUNHO de mensagem escrito pelo operador e devolver uma versão MELHORADA, pronta para enviar ao cliente.

REGRAS CRÍTICAS:
1. ${keep_meaning ? "MANTENHA EXATAMENTE o mesmo significado, regras e informações do rascunho. NÃO invente dados, valores, prazos ou condições que não estão no rascunho." : "Você pode reorganizar e enriquecer levemente o conteúdo, mas sem inventar dados específicos (valores, prazos, números)."}
2. Corrija ortografia, pontuação, concordância e clareza.
3. Reorganize em frases curtas e diretas. Quebre parágrafos longos.
4. Realce pontos importantes (ações que o cliente precisa fazer, avisos, restrições).
5. NÃO acrescente informações novas que não estavam no rascunho original.
6. NÃO mude o tom para mais agressivo nem mais permissivo do que o rascunho indica.
7. NÃO inclua saudação ("Olá, tudo bem?") a menos que o rascunho original já tenha.
8. NÃO inclua despedida ("Qualquer dúvida estou à disposição") a menos que o rascunho original já tenha.

ESTILO DE SAÍDA:
- Formato: ${styleLabel}.
- Tom de voz: ${toneLabel}.
- Português brasileiro.
- Use ✅ para listar etapas/ações e ⚠️ para avisos quando fizer sentido.

${extra_instructions ? `INSTRUÇÕES ADICIONAIS DO OPERADOR:\n${extra_instructions}\n` : ""}
SAÍDA:
Responda APENAS com a mensagem melhorada, sem comentários, sem cabeçalhos, sem aspas, sem explicações.`;

    const userPrompt = `RASCUNHO ORIGINAL:
"""
${draft.trim()}
"""

Devolva a versão melhorada agora.`;

    let apiUrl: string;
    let apiKey: string;
    let model: string;

    if (aiProvider === "openai") {
      if (!openaiKey) throw new Error("Chave da API OpenAI não configurada");
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = openaiKey;
      model = aiModel || "gpt-4o-mini";
    } else if (aiProvider === "groq") {
      if (!groqKey) throw new Error("Chave da API Groq não configurada");
      apiUrl = "https://api.groq.com/openai/v1/chat/completions";
      apiKey = groqKey;
      model = aiModel || "llama-3.1-70b-versatile";
    } else {
      if (!lovableApiKey) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = lovableApiKey;
      model = aiModel || "google/gemini-2.5-flash";
    }

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("Erro ao melhorar mensagem via IA");
    }

    const result = await aiResponse.json();
    const improved = result.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ improved, provider: aiProvider, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("❌ Melhorar mensagem error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
