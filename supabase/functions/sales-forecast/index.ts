import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Validate user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Load pipeline data
    const [stagesRes, pipelineRes, recentClosedRes] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("order_index"),
      supabase
        .from("client_pipeline")
        .select(
          "id, stage_id, is_lead, lead_score, moved_at, converted_at, last_interaction_at, lead_produto, cliente:clientes(id, nome, produto, valor, moeda, data_renovacao, cobranca_ativa)",
        ),
      supabase
        .from("client_pipeline")
        .select("converted_at, cliente:clientes(valor, moeda)")
        .not("converted_at", "is", null)
        .gte(
          "converted_at",
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        ),
    ]);

    if (stagesRes.error) throw stagesRes.error;
    if (pipelineRes.error) throw pipelineRes.error;

    const stages = stagesRes.data ?? [];
    const pipeline = pipelineRes.data ?? [];
    const recentClosed = recentClosedRes.data ?? [];

    // 2) Aggregate metrics per stage
    const stageSummary = stages.map((s: any) => {
      const items = pipeline.filter((p: any) => p.stage_id === s.id);
      const valueBrl = items.reduce((sum: number, p: any) => {
        const v = Number(p.cliente?.valor || 0);
        const m = (p.cliente?.moeda || "BRL").toUpperCase();
        return sum + (m === "BRL" ? v : 0);
      }, 0);
      const valueUsd = items.reduce((sum: number, p: any) => {
        const v = Number(p.cliente?.valor || 0);
        const m = (p.cliente?.moeda || "BRL").toUpperCase();
        return sum + (m === "USD" ? v : 0);
      }, 0);
      const avgScore = items.length
        ? items.reduce(
            (sum: number, p: any) => sum + Number(p.lead_score || 0),
            0,
          ) / items.length
        : 0;
      return {
        name: s.name,
        order: s.order_index,
        count: items.length,
        valueBrl: Math.round(valueBrl * 100) / 100,
        valueUsd: Math.round(valueUsd * 100) / 100,
        avgScore: Math.round(avgScore),
      };
    });

    const totalLeads = pipeline.length;
    const hotLeads = pipeline.filter(
      (p: any) => Number(p.lead_score || 0) >= 75,
    ).length;
    const warmLeads = pipeline.filter((p: any) => {
      const s = Number(p.lead_score || 0);
      return s >= 50 && s < 75;
    }).length;
    const coldLeads = pipeline.filter(
      (p: any) => Number(p.lead_score || 0) < 50,
    ).length;

    const pipelineValueBrl = stageSummary.reduce(
      (s, x) => s + x.valueBrl,
      0,
    );
    const pipelineValueUsd = stageSummary.reduce(
      (s, x) => s + x.valueUsd,
      0,
    );

    // Historical conversion (last 90 days)
    const closedRevenueBrl = recentClosed.reduce((sum: number, p: any) => {
      const v = Number(p.cliente?.valor || 0);
      const m = (p.cliente?.moeda || "BRL").toUpperCase();
      return sum + (m === "BRL" ? v : 0);
    }, 0);
    const closedRevenueUsd = recentClosed.reduce((sum: number, p: any) => {
      const v = Number(p.cliente?.valor || 0);
      const m = (p.cliente?.moeda || "BRL").toUpperCase();
      return sum + (m === "USD" ? v : 0);
    }, 0);
    const closedCount = recentClosed.length;
    const monthlyAvgBrl = closedRevenueBrl / 3;
    const monthlyAvgUsd = closedRevenueUsd / 3;

    // Period: current month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysIntoMonth = now.getDate();
    const daysInMonth = periodEnd.getDate();
    const monthProgress = Math.round((daysIntoMonth / daysInMonth) * 100);

    const summaryForAI = {
      currentDate: now.toISOString().slice(0, 10),
      monthProgress: `${monthProgress}% do mês atual`,
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      pipelineValueBrl,
      pipelineValueUsd,
      stagesSummary: stageSummary,
      historical90d: {
        closedDeals: closedCount,
        revenueBrl: Math.round(closedRevenueBrl * 100) / 100,
        revenueUsd: Math.round(closedRevenueUsd * 100) / 100,
        monthlyAvgBrl: Math.round(monthlyAvgBrl * 100) / 100,
        monthlyAvgUsd: Math.round(monthlyAvgUsd * 100) / 100,
      },
    };

    // 3) Call Lovable AI with tool calling for structured output
    const systemPrompt = `Você é um analista de vendas sênior especializado em previsão (forecasting) para CRMs B2B.
Sua tarefa: prever quanto a empresa vai fechar (converter em receita) ATÉ O FIM DO MÊS ATUAL com base nos dados do pipeline.

Considere:
- Estágios mais avançados têm probabilidade muito maior de conversão (ex: "Negociação" ~60-80%, "Proposta enviada" ~40-60%, "Contato" ~10-20%, "Novo lead" ~3-10%).
- Lead score alto (>=75) aumenta a probabilidade.
- O progresso do mês importa: se já estamos no fim do mês, só negócios muito quentes podem fechar.
- Use a média histórica como âncora de sanidade.
- Confidence reflete consistência dos dados: poucos leads, scores baixos ou histórico curto = confiança menor.

Seja realista, não otimista. Responda em português brasileiro.`;

    const userPrompt = `Analise estes dados do pipeline e gere a previsão para o mês:\n\n${JSON.stringify(summaryForAI, null, 2)}`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
          tools: [
            {
              type: "function",
              function: {
                name: "submit_sales_forecast",
                description:
                  "Submit the structured sales forecast for the current month.",
                parameters: {
                  type: "object",
                  properties: {
                    predicted_revenue_brl: {
                      type: "number",
                      description:
                        "Receita prevista em BRL para o restante do mês (apenas o que ainda vai fechar).",
                    },
                    predicted_revenue_usd: {
                      type: "number",
                      description:
                        "Receita prevista em USD para o restante do mês.",
                    },
                    confidence_pct: {
                      type: "integer",
                      description:
                        "Nível de confiança da previsão de 0 a 100.",
                    },
                    reasoning: {
                      type: "string",
                      description:
                        "Explicação curta (3-5 frases) do raciocínio por trás da previsão.",
                    },
                    recommended_actions: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Ações recomendadas para aumentar a probabilidade de bater a previsão (3-5 itens).",
                    },
                    risks: {
                      type: "array",
                      items: { type: "string" },
                      description: "Principais riscos identificados (2-4 itens).",
                    },
                    opportunities: {
                      type: "array",
                      items: { type: "string" },
                      description:
                        "Oportunidades concretas no pipeline (2-4 itens).",
                    },
                  },
                  required: [
                    "predicted_revenue_brl",
                    "predicted_revenue_usd",
                    "confidence_pct",
                    "reasoning",
                    "recommended_actions",
                    "risks",
                    "opportunities",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "submit_sales_forecast" },
          },
        }),
      },
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error:
              "Limite de requisições atingido. Aguarde alguns segundos e tente novamente.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos da IA esgotados. Adicione créditos no workspace Lovable.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return a structured forecast.");
    }

    const forecast = JSON.parse(toolCall.function.arguments);

    // 4) Persist
    const { data: saved, error: insertError } = await supabase
      .from("sales_forecasts")
      .insert({
        generated_by: userId,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        predicted_revenue_brl: forecast.predicted_revenue_brl,
        predicted_revenue_usd: forecast.predicted_revenue_usd,
        confidence_pct: forecast.confidence_pct,
        pipeline_value_brl: pipelineValueBrl,
        pipeline_value_usd: pipelineValueUsd,
        total_leads: totalLeads,
        hot_leads: hotLeads,
        warm_leads: warmLeads,
        cold_leads: coldLeads,
        reasoning: forecast.reasoning,
        recommended_actions: forecast.recommended_actions,
        risks: forecast.risks,
        opportunities: forecast.opportunities,
        raw_analysis: { input: summaryForAI, output: forecast },
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, forecast: saved }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("sales-forecast error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
