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

    // lovableApiKey may be null if using external provider


    const { produto, client_name, translate_to, original_message } = await req.json();

    // If this is a translation request, handle it separately
    if (translate_to && original_message) {
      const langNames: Record<string, string> = {
        'pt-BR': 'português brasileiro',
        'en': 'inglês',
        'es': 'espanhol',
        'fr': 'francês',
        'it': 'italiano',
        'de': 'alemão',
      };
      const targetLangName = langNames[translate_to] || translate_to;

      // Get AI provider config
      const { data: providerConfig } = await supabase
        .from("followup_config")
        .select("config_key, config_value")
        .in("config_key", ["ai_provider", "ai_model", "ai_api_key_openai", "ai_api_key_groq"]);

      const getV = (key: string, fb: string) =>
        providerConfig?.find((c: any) => c.config_key === key)?.config_value || fb;

      const aiProv = getV("ai_provider", "lovable");
      const aiMod = getV("ai_model", "");
      const oKey = getV("ai_api_key_openai", "");
      const gKey = getV("ai_api_key_groq", "");

      let tUrl: string, tKey: string, tModel: string;
      if (aiProv === "openai") {
        if (!oKey) throw new Error("Chave da API OpenAI não configurada");
        tUrl = "https://api.openai.com/v1/chat/completions";
        tKey = oKey;
        tModel = aiMod || "gpt-4o-mini";
      } else if (aiProv === "groq") {
        if (!gKey) throw new Error("Chave da API Groq não configurada");
        tUrl = "https://api.groq.com/openai/v1/chat/completions";
        tKey = gKey;
        tModel = aiMod || "llama-3.1-70b-versatile";
      } else {
        if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");
        tUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        tKey = lovableApiKey;
        tModel = aiMod || "google/gemini-2.5-flash";
      }

      const tResp = await fetch(tUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${tKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: tModel,
          messages: [
            { role: "system", content: `Você é um tradutor profissional. Traduza a mensagem abaixo para ${targetLangName}. Mantenha a formatação do WhatsApp (*negrito*, _itálico_), emojis e o tom da mensagem original. Retorne APENAS a mensagem traduzida, sem explicações.` },
            { role: "user", content: original_message },
          ],
        }),
      });

      if (!tResp.ok) {
        const errText = await tResp.text();
        console.error("Translation error:", tResp.status, errText);
        throw new Error("Erro na tradução");
      }

      const tResult = await tResp.json();
      const translated = tResult.choices?.[0]?.message?.content || "";

      return new Response(
        JSON.stringify({ message: translated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get AI provider config
    const { data: providerConfig } = await supabase
      .from("followup_config")
      .select("config_key, config_value")
      .in("config_key", [
        "ai_provider", "ai_model", "ai_api_key_openai", "ai_api_key_groq", "ai_custom_prompt"
      ]);

    const getVal = (key: string, fallback: string) =>
      providerConfig?.find((c: any) => c.config_key === key)?.config_value || fallback;

    const aiProvider = getVal("ai_provider", "lovable");
    const aiModel = getVal("ai_model", "");
    const openaiKey = getVal("ai_api_key_openai", "");
    const groqKey = getVal("ai_api_key_groq", "");

    if (!produto || typeof produto !== "string" || produto.length > 200) {
      return new Response(
        JSON.stringify({ error: "Produto inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if AI is enabled
    const { data: configData } = await supabase
      .from("followup_config")
      .select("config_value")
      .eq("config_key", "ai_message_enabled")
      .single();

    if (!configData || configData.config_value !== "true") {
      return new Response(
        JSON.stringify({ error: "Geração por IA desabilitada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get external Supabase anon key from config
    const { data: externalKeyConfig } = await supabase
      .from("followup_config")
      .select("config_value")
      .eq("config_key", "external_supabase_anon_key")
      .single();

    const externalAnonKey = externalKeyConfig?.config_value || "";

    // Search for matching products in agency_products (internal)
    const { data: products } = await supabase
      .from("agency_products")
      .select("nome, descricao, beneficios, categoria, preco, detalhes_extras")
      .eq("is_active", true);

    // Also fetch from external project if configured
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
          console.warn("External project fetch failed:", extResponse.status);
        }
      } catch (err) {
        console.warn("Error fetching external products:", err);
      }
    }

    // Find best match (case-insensitive partial match)
    const produtoLower = produto.toLowerCase();
    const matchedProducts = (products || []).filter((p: any) =>
      p.nome.toLowerCase().includes(produtoLower) ||
      produtoLower.includes(p.nome.toLowerCase()) ||
      (p.categoria && p.categoria.toLowerCase().includes(produtoLower))
    );

    // Match external products
    const matchedExternal = externalProducts.filter((p: any) =>
      (p.titulo_produto && p.titulo_produto.toLowerCase().includes(produtoLower)) ||
      (p.titulo_produto && produtoLower.includes(p.titulo_produto.toLowerCase()))
    );

    let productContext = "";

    // Build context from internal products
    if (matchedProducts.length > 0) {
      productContext = matchedProducts
        .map((p: any) => {
          const parts = [`Produto: ${p.nome}`];
          if (p.descricao) parts.push(`Descrição: ${p.descricao}`);
          if (p.beneficios) parts.push(`Benefícios: ${p.beneficios}`);
          if (p.preco) parts.push(`Preço: ${p.preco}`);
          if (p.detalhes_extras) parts.push(`Detalhes: ${p.detalhes_extras}`);
          return parts.join("\n");
        })
        .join("\n---\n");
    } else if (products && products.length > 0) {
      productContext = (products || [])
        .slice(0, 10)
        .map((p: any) => `- ${p.nome}: ${p.descricao || "sem descrição"}`)
        .join("\n");
      productContext = `Produtos disponíveis na agência:\n${productContext}\n\nO cliente demonstrou interesse em: "${produto}"`;
    }

    // Append external product context
    if (matchedExternal.length > 0) {
      const extContext = matchedExternal
        .slice(0, 5)
        .map((p: any) => {
          const parts = [`Produto Externo: ${p.titulo_produto}`];
          if (p.content) parts.push(`Conteúdo: ${p.content.substring(0, 1000)}`);
          return parts.join("\n");
        })
        .join("\n---\n");
      productContext += (productContext ? "\n\n=== Base Externa ===\n" : "") + extContext;
    } else if (externalProducts.length > 0 && !matchedProducts.length) {
      const extContext = externalProducts
        .slice(0, 10)
        .map((p: any) => `- ${p.titulo_produto || "sem título"}`)
        .join("\n");
      productContext += (productContext ? "\n\n" : "") + `Produtos da base externa:\n${extContext}`;
    }

    const safeName = (client_name || "Cliente").substring(0, 100);

    // Get custom prompt or use default
    const customPrompt = getVal("ai_custom_prompt", "");
    const systemPrompt = customPrompt || `Você é um assistente de vendas de uma agência digital. Gere uma mensagem de follow-up personalizada para WhatsApp.

REGRAS:
- Mensagem curta e direta (máximo 4 parágrafos)
- Tom profissional mas amigável
- Use emojis moderadamente
- Mencione benefícios específicos do produto quando disponível
- NÃO invente preços ou detalhes que não estejam no contexto
- A mensagem deve ser para reengajar o cliente que demonstrou interesse
- Use formatação do WhatsApp (*negrito*, _itálico_)
- Escreva em português brasileiro`;

    const userPrompt = `Gere uma mensagem de follow-up para o cliente "${safeName}" que demonstrou interesse no produto "${produto}".

Informações do produto no banco de dados:
${productContext}`;

    // Determine API URL, key, and model based on provider
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
      // Lovable AI (default)
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
      throw new Error("Erro na geração de mensagem por IA");
    }

    const result = await aiResponse.json();
    const message = result.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ message, matched_products: matchedProducts.length, matched_external: matchedExternal.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("❌ Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
