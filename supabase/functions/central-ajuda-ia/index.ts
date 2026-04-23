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

    // ---- Build keyword list & intent detection ----
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Stopwords PT que não ajudam na busca
    const STOPWORDS = new Set([
      "qual", "quais", "como", "onde", "quando", "porque", "por que", "para", "pelo", "pela",
      "esse", "essa", "isso", "aquele", "aquela", "aquilo", "este", "esta", "isto",
      "tem", "ter", "tenho", "temos", "estao", "estar", "ser", "sao", "foi", "era",
      "dos", "das", "uma", "uns", "umas", "com", "sem", "sob", "sobre", "entre",
      "mais", "menos", "muito", "pouco", "tudo", "nada", "algo", "voce", "voces",
      "minha", "meu", "seu", "sua", "nosso", "nossa", "deles", "delas",
      "tabela", "lista", "informacao", "informacoes", "dados", "detalhe", "detalhes",
      "favor", "obrigado", "obrigada", "ajuda", "duvida", "pergunta",
    ]);

    // Sinônimos / expansão de termos comuns na agência
    const SYNONYMS: Record<string, string[]> = {
      disparo: ["disparador", "disparos", "envio", "envios", "mensagem", "mensagens", "acdbot", "marketing"],
      disparador: ["disparo", "disparos", "envio", "envios", "acdbot"],
      preco: ["valor", "valores", "plano", "planos", "mensal", "mensais", "anual", "custa", "custo"],
      valor: ["preco", "preços", "plano", "planos", "tabela", "custa"],
      valores: ["preco", "preços", "planos", "tabela"],
      plano: ["preco", "valor", "valores", "mensalidade", "assinatura"],
      planos: ["preco", "valores", "mensalidade", "assinatura"],
      numero: ["aquecido", "aquecimento", "blindado", "contingencia", "chip"],
      numeros: ["aquecidos", "aquecimento", "blindados", "contingencia", "chips"],
      aquecimento: ["aquecido", "aquecidos", "zapheat", "blindado", "maturacao"],
      aquecido: ["aquecimento", "blindado", "zapheat"],
      banimento: ["desbanimento", "banido", "bloqueado", "bloqueio", "ban"],
      desbanimento: ["banimento", "banido", "desbanir", "recuperar"],
      grupo: ["grupos", "wagroup", "comunidade"],
      ia: ["inteligencia", "agente", "automacao", "bot"],
      site: ["landing", "page", "pagina", "criacao"],
      trafego: ["anuncio", "anuncios", "ads", "facebook", "google", "meta"],
      sms: ["rcs", "mensagem"],
    };

    const expandTerms = (text: string): Set<string> => {
      const out = new Set<string>();
      const words = normalize(text).split(/\W+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
      for (const w of words) {
        out.add(w);
        const syns = SYNONYMS[w];
        if (syns) syns.forEach((s) => out.add(normalize(s)));
      }
      return out;
    };

    const questionNorm = normalize(question);
    const produtoNorm = produto ? normalize(produto) : "";

    const expandedTerms = Array.from(
      new Set([...expandTerms(question), ...expandTerms(produto || "")])
    );

    // Detect intents
    const isPriceQuestion = /\b(preco|preço|valor|valores|custa|custo|quanto|cobra|cobranca|cobrança|centavo|centavos|reais|r\$|tabela|plano|planos|mensalidade|assinatura)\b/i.test(question);
    const isFAQQuestion = /\b(como|funciona|posso|consigo|onde|quando|porque|por que|preciso|tem como|funcionalidade|recurso)\b/i.test(question);

    const matches = (text: string, opts?: { isPriceField?: boolean; isTitleField?: boolean; isContentField?: boolean }) => {
      if (!text) return 0;
      const t = normalize(text);
      let score = 0;
      for (const w of expandedTerms) {
        if (!w) continue;
        // Match palavra inteira (com fronteiras) vale mais que substring
        const wholeWord = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t);
        if (wholeWord) {
          score += opts?.isTitleField ? 6 : opts?.isContentField ? 2 : 1;
        } else if (t.includes(w)) {
          score += opts?.isTitleField ? 3 : 1;
        }
      }
      // Boost preço quando a pergunta é sobre valor
      if (opts?.isPriceField && isPriceQuestion && t.trim().length > 0) {
        score += 5;
      }
      // Boost forte se conteúdo contém "preco/valor/plano" e pergunta é sobre valor
      if (opts?.isContentField && isPriceQuestion) {
        if (/(r\$|preco|preço|plano|valor|mensal|anual)/i.test(t)) score += 3;
      }
      // Strong boost when the produto field is contained in the title
      if (produtoNorm && opts?.isTitleField && t.includes(produtoNorm)) {
        score += 15;
      }
      return score;
    };

    const scoredInternal = (internalProducts || [])
      .map((p: any) => ({
        p,
        score:
          matches(p.nome || "", { isTitleField: true }) +
          matches(p.categoria || "", { isTitleField: true }) +
          matches(p.descricao || "", { isContentField: true }) +
          matches(p.beneficios || "", { isContentField: true }) +
          matches(p.detalhes_extras || "", { isContentField: true }) +
          matches(p.preco || "", { isPriceField: true }),
      }))
      .sort((a, b) => b.score - a.score);

    const scoredExternal = externalProducts
      .map((p: any) => ({
        p,
        score:
          matches(p.titulo_produto || "", { isTitleField: true }) +
          matches(p.content || "", { isContentField: true }),
      }))
      .sort((a, b) => b.score - a.score);

    const MIN_SCORE = 3;
    const topInternal = scoredInternal.filter((x) => x.score >= MIN_SCORE).slice(0, 4);
    const topExternal = scoredExternal.filter((x) => x.score >= MIN_SCORE).slice(0, 4);

    // Fallback: se nada bateu, manda catálogo geral mais rico para a IA escolher
    const useFallbackInternal = topInternal.length === 0 ? scoredInternal.slice(0, 6) : topInternal;
    const useFallbackExternal = topExternal.length === 0 ? scoredExternal.slice(0, 6) : topExternal;

    // Para perguntas de preço, extrai o trecho de PRECO/PLANOS do conteúdo externo
    const extractPriceSection = (content: string): string => {
      if (!content) return "";
      // Captura linhas que mencionam preço, R$, plano, mensal, anual
      const lines = content.split(/\n+/);
      const relevant = lines.filter((l) =>
        /(r\$|preco|preço|plano|valor|mensal|anual|gratuito|gratis|grátis|teste)/i.test(l)
      );
      return relevant.slice(0, 15).join("\n");
    };

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
      knowledgeBase += (knowledgeBase ? "\n\n" : "") + "=== BASE EXTERNA (Catálogo de Produtos) ===\n";
      knowledgeBase += useFallbackExternal
        .map(({ p }: any) => {
          const parts = [`Título: ${p.titulo_produto || "sem título"}`];
          const fullContent = String(p.content || "");
          if (fullContent) {
            // Para perguntas de preço, destaca a seção de valores no topo
            if (isPriceQuestion) {
              const priceSection = extractPriceSection(fullContent);
              if (priceSection) {
                parts.push(`💰 INFORMAÇÕES DE PREÇO/PLANOS:\n${priceSection}`);
              }
            }
            // Conteúdo completo aumentado para 4000 chars (cabe descrição + FAQ relevante)
            parts.push(`Conteúdo completo:\n${fullContent.substring(0, 4000)}`);
          }
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
1. RESPONDA APENAS O QUE FOI PERGUNTADO. Se o cliente perguntou sobre PREÇO, responda sobre PREÇO. Se perguntou sobre PRAZO, responda sobre PRAZO.
2. Identifique no contexto fornecido APENAS o trecho que responde à pergunta. Ignore tudo o que não for diretamente relevante.
3. Se houver MÚLTIPLOS produtos no contexto, escolha o que melhor corresponde ao produto/assunto da pergunta. NÃO misture produtos diferentes na mesma resposta.
4. NÃO faça introduções genéricas sobre o que a empresa faz. Vá direto ao ponto.

REGRAS PARA PERGUNTAS SOBRE VALORES / TABELA DE PREÇOS:
- Quando o cliente pedir "tabela de valores", "preços", "planos", "quanto custa", LISTE TODOS OS PLANOS disponíveis no produto identificado, com nome do plano e valor (ex: "Plano Start: R$ 59/mês • Plano Advanced: R$ 89/mês • Plano Advanced Plus: R$ 147/mês").
- Use a seção "💰 INFORMAÇÕES DE PREÇO/PLANOS" do contexto como FONTE PRIMÁRIA quando ela aparecer.
- Se houver múltiplas modalidades (mensal/anual, por número, com seguro), inclua TODAS de forma organizada e legível.
- Se o cliente NÃO especificou o produto e existir mais de um produto possível no contexto, pergunte de forma curta qual produto ele quer saber o valor — OU liste os 2-3 produtos principais com seus preços, separados claramente.
- NUNCA invente valores. Se o preço não estiver no contexto, diga que vai confirmar com o time.

REGRAS DE CONTEÚDO:
- Use APENAS as informações do contexto (Base Interna e Base Externa). NÃO invente dados, preços, prazos ou políticas.
- Se a informação EXATA não estiver no contexto, diga educadamente que vai confirmar com o time e retorna em instantes.
- Se o contexto trouxer informação de produto DIFERENTE do que foi perguntado, IGNORE.

REGRAS DE FORMATO:
- Tom de voz: ${toneLabel}.
- Português brasileiro.
- Mensagem CURTA e DIRETA. Para tabela de preços, pode usar lista com bullets ou linhas separadas para ficar legível.
- Formatação leve do WhatsApp (*negrito* para destacar nomes de planos e valores) quando ajudar.
- Emojis com moderação (no máximo 2).
- Cumprimento curto usando o nome do cliente, sem saudações exageradas.
- NUNCA mencione "base de dados", "contexto", "informações fornecidas" ou que você é uma IA.`;

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
