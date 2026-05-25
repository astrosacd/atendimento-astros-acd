import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_INSIGHTS = `Você é um analista sênior de marketing de Instagram brasileiro. Vai receber um JSON com posts de concorrentes (legenda, métricas, hashtags, tipo de mídia, data). Sua tarefa é gerar um relatório de INSIGHTS em JSON válido, sem nenhum texto fora do JSON. Estrutura obrigatória:

{
  "resumo_executivo": "2-3 frases destacando o que mais salta aos olhos",
  "padroes_horario": [{"faixa": "ex: 18h-21h", "qtd_posts": 0, "engajamento_medio": 0}],
  "melhores_dias_semana": ["segunda", "..."],
  "top_hashtags": [{"hashtag": "#x", "frequencia": 0, "engajamento_medio": 0}],
  "formatos_campeoes": [{"tipo": "REEL/IMAGE/CAROUSEL", "engajamento_medio": 0, "qtd": 0}],
  "ganchos_de_legenda": ["padrão 1 observado nas legendas", "padrão 2"],
  "posts_destaque": [{"permalink": "...", "motivo": "por que se destacou", "likes": 0, "comments": 0}],
  "recomendacoes": ["recomendação tática 1", "recomendação 2"]
}

Use português brasileiro. Seja específico, cite números reais. Nunca invente dados que não estão no JSON.`;

const SYSTEM_SUGESTOES = `Você é um copywriter sênior e estrategista de conteúdo para Instagram. Vai receber posts de concorrentes (legendas, métricas, hashtags, formato). Sua tarefa é gerar 5 IDEIAS PRONTAS de conteúdo inspiradas (não copiadas) nos padrões campeões observados. Responda APENAS com JSON válido, sem texto fora. Estrutura:

{
  "contexto_observado": "1-2 frases descrevendo o que os concorrentes estão fazendo bem",
  "sugestoes": [
    {
      "titulo": "nome curto da ideia",
      "formato": "REEL | CARROSSEL | POST_IMAGEM | STORY",
      "gancho": "primeira frase/abertura do conteúdo (3-7 segundos do Reel ou primeira linha do post)",
      "roteiro": "passo a passo do conteúdo, cena a cena se for Reel ou slide a slide se for carrossel",
      "legenda": "legenda pronta para publicar (com quebras de linha, emojis estratégicos, CTA no final)",
      "hashtags": ["#x", "#y"],
      "cta": "call-to-action específico",
      "inspirado_em": "explica brevemente em qual padrão dos concorrentes essa ideia se baseia"
    }
  ]
}

Use português brasileiro coloquial e estratégico. As ideias devem ser executáveis hoje, não genéricas.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const competitorId: string | null = body.competitor_id || null;
    const analysisType: "insights" | "sugestoes" = body.analysis_type || "insights";
    const periodDays: number = Math.max(1, Math.min(365, body.period_days || 30));

    if (!["insights", "sugestoes"].includes(analysisType)) {
      return new Response(JSON.stringify({ error: "analysis_type inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    let postsQuery = admin
      .from("instagram_competitor_posts")
      .select("competitor_id, media_type, media_product_type, caption, permalink, like_count, comments_count, views_count, hashtags, posted_at, instagram_competitors!inner(username, display_name, category)")
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(150);

    if (competitorId) postsQuery = postsQuery.eq("competitor_id", competitorId);

    const { data: posts, error: pErr } = await postsQuery;
    if (pErr) throw pErr;
    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({
        error: "Nenhum post encontrado nesse período. Sincronize os concorrentes primeiro.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const compactPosts = posts.map((p: any) => ({
      perfil: p.instagram_competitors?.username,
      categoria: p.instagram_competitors?.category,
      tipo: p.media_product_type || p.media_type,
      legenda: (p.caption || "").slice(0, 600),
      likes: p.like_count,
      comments: p.comments_count,
      views: p.views_count,
      hashtags: p.hashtags,
      data: p.posted_at,
      link: p.permalink,
    }));

    const systemPrompt = analysisType === "insights" ? SYSTEM_INSIGHTS : SYSTEM_SUGESTOES;
    const userPrompt = `Analise os ${compactPosts.length} posts abaixo dos últimos ${periodDays} dias. Retorne APENAS o JSON conforme a estrutura especificada.\n\n${JSON.stringify(compactPosts)}`;

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Configurações > Workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${aiRes.status} ${errText}`);
    }

    const aiJson = await aiRes.json();
    let content = aiJson.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string" || !content.trim()) {
      console.error("AI returned empty content:", JSON.stringify(aiJson).slice(0, 500));
      throw new Error("IA retornou resposta vazia. Tente novamente.");
    }
    // Strip ```json fences if present
    content = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract first {...} block
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* fallthrough */ }
      }
      if (!parsed) {
        console.error("Failed to parse AI content:", content.slice(0, 500));
        throw new Error("IA retornou JSON inválido");
      }
    }
    if (!parsed || typeof parsed !== "object" || Object.keys(parsed).length === 0) {
      throw new Error("IA retornou conteúdo vazio");
    }

    const { data: saved, error: sErr } = await admin
      .from("instagram_competitor_analyses")
      .insert({
        competitor_id: competitorId,
        analysis_type: analysisType,
        period_days: periodDays,
        content: parsed,
        posts_analyzed_count: posts.length,
        model_used: "google/gemini-2.5-pro",
        created_by: userId,
      })
      .select()
      .single();

    if (sErr) throw sErr;

    return new Response(JSON.stringify({ analysis: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("instagram-spy-analyze error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
