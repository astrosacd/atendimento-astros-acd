import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { question, client_name, produto, tone } = await req.json();

    if (!question || typeof question !== "string" || question.length < 3 || question.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Pergunta inválida (mínimo 3 e máximo 2000 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reuse AI provider config from followup_config (same setup)
    const { data: providerConfig } = await supabase
      .from("followup_config")
      .select("config_key, config_value")
      .in("config_key", [
        "ai_provider", "ai_model",
        "ai_api_key_openai", "ai_api_key_groq",
        "external_supabase_anon_key",
      ]);

    const getVal = (key: string, fallback: string) =>
      providerConfig?.find((c: any) => c.config_key === key)?.config_value || fallback;

    const aiProvider = getVal("ai_provider", "lovable");
    const aiModel = getVal("ai_model", "");
    const openaiKey = getVal("ai_api_key_openai", "");
    const groqKey = getVal("ai_api_key_groq", "");
    const externalAnonKey = getVal("external_supabase_anon_key", "");

    // 1) Internal products (agency_products)
    const { data: internalProducts } = await supabase
      .from("agency_products")
      .select("nome, descricao, beneficios, categoria, preco, detalhes_extras")
      .eq("is_active", true);

    // 2) External base (same external project used by follow-up)
    let externalProducts: any[] = [];
    if (externalAnonKey) {
      try {
        const externalUrl = "https://tevljvidqbvrcgzqypwf.supabase.co";
        const extResponse = await fetch(
          `${externalUrl}/rest/v1/base_produtos_acd?select=titulo_produto,content`,
          {
            headers: {
              "apikey": externalAnonKey,
              "Authorization": `Bearer ${externalAnonKey}`,
            },
          }
        );
        if (extResponse.ok) {
          externalProducts = await extResponse.json();
        } else {
          console.warn("External fetch failed:", extResponse.status);
        }
      } catch (err) {
        console.warn("External fetch error:", err);
      }
    }

    // Build keyword list from question (+ optional produto) for relevance filter
    const haystackWords = (`${question} ${produto || ""}`)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/\W+/)
      .filter((w) => w.length >= 4);
    const uniqueWords = Array.from(new Set(haystackWords));

    const matches = (text: string) => {
      if (!text) return 0;
      const t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let score = 0;
      for (const w of uniqueWords) if (t.includes(w)) score++;
      return score;
    };

    const scoredInternal = (internalProducts || [])
      .map((p: any) => ({
        p,
        score: matches(`${p.nome} ${p.descricao || ""} ${p.beneficios || ""} ${p.categoria || ""} ${p.detalhes_extras || ""}`),
      }))
      .sort((a, b) => b.score - a.score);

    const scoredExternal = externalProducts
      .map((p: any) => ({
        p,
        score: matches(`${p.titulo_produto || ""} ${p.content || ""}`),
      }))
      .sort((a, b) => b.score - a.score);

    const topInternal = scoredInternal.filter((x) => x.score > 0).slice(0, 5);
    const topExternal = scoredExternal.filter((x) => x.score > 0).slice(0, 5);

    // Fallback: if nothing matched, send a slim general catalog so the model still has context
    const useFallbackInternal = topInternal.length === 0 ? scoredInternal.slice(0, 5) : topInternal;
    const useFallbackExternal = topExternal.length === 0 ? scoredExternal.slice(0, 5) : topExternal;

    let knowledgeBase = "";
    if (useFallbackInternal.length > 0) {
      knowledgeBase += "=== BASE INTERNA (Produtos da Agência) ===\n";
      knowledgeBase += useFallbackInternal
        .map(({ p }: any) => {
          const parts = [`Produto: ${p.nome}`];
          if (p.categoria) parts.push(`Categoria: ${p.categoria}`);
          if (p.descricao) parts.push(`Descrição: ${p.descricao}`);
          if (p.beneficios) parts.push(`Benefícios: ${p.beneficios}`);
          if (p.preco) parts.push(`Preço: ${p.preco}`);
          if (p.detalhes_extras) parts.push(`Detalhes: ${p.detalhes_extras}`);
          return parts.join("\n");
        })
        .join("\n---\n");
    }

    if (useFallbackExternal.length > 0) {
      knowledgeBase += (knowledgeBase ? "\n\n" : "") + "=== BASE EXTERNA ===\n";
      knowledgeBase += useFallbackExternal
        .map(({ p }: any) => {
          const parts = [`Título: ${p.titulo_produto || "sem título"}`];
          if (p.content) parts.push(`Conteúdo: ${String(p.content).substring(0, 1500)}`);
          return parts.join("\n");
        })
        .join("\n---\n");
    }

    if (!knowledgeBase) {
      knowledgeBase = "Nenhuma informação relevante foi encontrada nas bases. Responda de forma genérica e honesta, sem inventar dados.";
    }

    const safeName = (client_name || "o cliente").substring(0, 100);
    const safeProduto = produto ? produto.substring(0, 200) : "";
    const toneLabel = tone === "formal"
      ? "formal e corporativo"
      : tone === "tecnico"
      ? "técnico e objetivo"
      : "amigável e profissional";

    const systemPrompt = `Você é um assistente especialista da agência, atuando como uma "Central de Ajuda" para o operador responder clientes.

SUA MISSÃO:
Ler a PERGUNTA EXATA do cliente e gerar uma RESPOSTA PRONTA que responda ESPECIFICAMENTE àquela pergunta — nada mais, nada menos.

REGRAS DE FOCO (CRÍTICAS):
1. RESPONDA APENAS O QUE FOI PERGUNTADO. Se o cliente perguntou sobre PREÇO, responda sobre PREÇO. Se perguntou sobre PRAZO, responda sobre PRAZO. NÃO traga informações de outros produtos ou tópicos não solicitados.
2. Identifique no contexto fornecido APENAS o trecho que responde à pergunta. Ignore tudo o que não for diretamente relevante.
3. Se houver MÚLTIPLOS produtos no contexto, escolha APENAS o que melhor corresponde ao produto/assunto da pergunta. NÃO misture produtos diferentes.
4. NÃO faça introduções genéricas sobre o que a empresa faz. Vá direto ao ponto.
5. Se a pergunta for sobre um valor específico (ex: "quanto custa o disparo?"), retorne APENAS o valor e a unidade (ex: "R$ 0,20 por disparo"). Não fale sobre outros serviços.

REGRAS DE CONTEÚDO:
- Use APENAS as informações do contexto (Base Interna e Base Externa). NÃO invente dados, preços, prazos ou políticas.
- Se a informação EXATA não estiver no contexto, diga educadamente que vai confirmar com o time e retorna em instantes. NÃO chute, NÃO ofereça informação parecida de outro produto.
- Se o contexto trouxer informação de produto DIFERENTE do que foi perguntado, IGNORE e trate como "informação não disponível".

REGRAS DE FORMATO:
- Tom de voz: ${toneLabel}.
- Português brasileiro.
- Mensagem CURTA e DIRETA: idealmente 1-3 parágrafos curtos. Máximo absoluto de 5 parágrafos.
- Formatação leve do WhatsApp (*negrito*, _itálico_) apenas quando ajudar.
- Emojis com moderação (no máximo 2).
- Cumprimento curto usando o nome do cliente, sem saudações exageradas.
- NUNCA mencione "base de dados", "contexto", "informações fornecidas" ou que você é uma IA.
- NUNCA liste produtos ou serviços que o cliente não perguntou.`;

    const userPrompt = `Cliente: ${safeName}
${safeProduto ? `Produto/Assunto relacionado: ${safeProduto}\n` : ""}
PERGUNTA EXATA DO CLIENTE (responda SOMENTE isto):
"""
${question}
"""

CONHECIMENTO DISPONÍVEL (use APENAS o trecho que responde à pergunta acima; ignore o resto):
${knowledgeBase}

INSTRUÇÕES FINAIS:
1. Releia a pergunta do cliente.
2. Identifique no conhecimento o trecho que responde EXATAMENTE àquela pergunta.
3. Se não encontrar resposta exata, diga que vai confirmar com o time. NÃO ofereça informação de produto diferente.
4. Gere a mensagem curta, direta e pronta para o operador copiar e colar.`;

    // Resolve provider
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
      throw new Error("Erro na geração de resposta por IA");
    }

    const result = await aiResponse.json();
    const message = result.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        message,
        sources: {
          internal: useFallbackInternal.map(({ p }: any) => p.nome),
          external: useFallbackExternal.map(({ p }: any) => p.titulo_produto).filter(Boolean),
        },
        matched_internal: topInternal.length,
        matched_external: topExternal.length,
        provider: aiProvider,
        model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("❌ Central Ajuda error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
