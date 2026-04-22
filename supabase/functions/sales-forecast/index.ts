import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

    const now = new Date();
    const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS).toISOString();
    const oneYearAgo = new Date(Date.now() - 365 * DAY_MS).toISOString();

    // 1) Load enriched data in parallel
    const [
      stagesRes,
      pipelineRes,
      recentClosedRes,
      historicalMovesRes,
      proposalsRes,
      followupsRes,
    ] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("order_index"),
      supabase
        .from("client_pipeline")
        .select(
          "id, stage_id, is_lead, lead_score, moved_at, converted_at, last_interaction_at, lead_produto, chatwoot_conversation_id, notes, cliente:clientes(id, nome, produto, valor, moeda, data_renovacao, cobranca_ativa, created_at, excluir_metricas)",
        ),
      // Closed deals last 90 days
      supabase
        .from("client_pipeline")
        .select("converted_at, stage_id, cliente:clientes(valor, moeda, produto, excluir_metricas)")
        .not("converted_at", "is", null)
        .gte("converted_at", ninetyDaysAgo),
      // Historical stage transitions (1 year) for conversion rates per stage
      supabase
        .from("client_pipeline")
        .select("stage_id, converted_at, moved_at, is_lead")
        .gte("moved_at", oneYearAgo),
      // Proposals: status by client
      supabase
        .from("proposals")
        .select("client_id, status, total_value, currency, created_at, signed_at, cliente:clientes(excluir_metricas)")
        .gte("created_at", ninetyDaysAgo),
      // Follow-ups scheduled / executed
      supabase
        .from("client_followups")
        .select("cliente_id, status, scheduled_at, next_dispatch_at, conversion_status, cliente:clientes(excluir_metricas)")
        .gte("created_at", ninetyDaysAgo),
    ]);

    if (stagesRes.error) throw stagesRes.error;
    if (pipelineRes.error) throw pipelineRes.error;

    const stages = stagesRes.data ?? [];
    const pipeline = (pipelineRes.data ?? []).filter((p: any) => !p.cliente?.excluir_metricas);
    const recentClosed = (recentClosedRes.data ?? []).filter((p: any) => !p.cliente?.excluir_metricas);
    const historicalMoves = historicalMovesRes.data ?? [];
    const proposals = (proposalsRes.data ?? []).filter((p: any) => !p.cliente?.excluir_metricas);
    const followups = (followupsRes.data ?? []).filter((p: any) => !p.cliente?.excluir_metricas);

    // Build proposal map by client_id
    const proposalsByClient = new Map<string, any[]>();
    for (const p of proposals) {
      if (!p.client_id) continue;
      const arr = proposalsByClient.get(p.client_id) ?? [];
      arr.push(p);
      proposalsByClient.set(p.client_id, arr);
    }

    // Build followup map by cliente_id
    const followupsByClient = new Map<string, any[]>();
    for (const f of followups) {
      if (!f.cliente_id) continue;
      const arr = followupsByClient.get(f.cliente_id) ?? [];
      arr.push(f);
      followupsByClient.set(f.cliente_id, arr);
    }

    // 2) Historical conversion rates per stage (real data, not guesses)
    const stageHistory: Record<string, { total: number; converted: number }> = {};
    for (const m of historicalMoves) {
      if (!m.stage_id) continue;
      if (!stageHistory[m.stage_id]) stageHistory[m.stage_id] = { total: 0, converted: 0 };
      stageHistory[m.stage_id].total += 1;
      if (m.converted_at) stageHistory[m.stage_id].converted += 1;
    }

    // 3) Aggregate metrics per stage with enriched signals
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
        ? items.reduce((sum: number, p: any) => sum + Number(p.lead_score || 0), 0) /
          items.length
        : 0;

      // Avg days in stage (since moved_at)
      const avgDaysInStage = items.length
        ? items.reduce((sum: number, p: any) => {
            const moved = p.moved_at ? new Date(p.moved_at).getTime() : Date.now();
            return sum + (Date.now() - moved) / DAY_MS;
          }, 0) / items.length
        : 0;

      // Stuck leads (>30 days in stage)
      const stuckLeads = items.filter((p: any) => {
        if (!p.moved_at) return false;
        return (Date.now() - new Date(p.moved_at).getTime()) / DAY_MS > 30;
      }).length;

      // Cooling leads (no interaction in 14+ days)
      const coolingLeads = items.filter((p: any) => {
        if (!p.last_interaction_at) return true;
        return (Date.now() - new Date(p.last_interaction_at).getTime()) / DAY_MS > 14;
      }).length;

      // Historical conversion rate for this stage
      const hist = stageHistory[s.id];
      const historicalConversionRate = hist && hist.total >= 5
        ? Math.round((hist.converted / hist.total) * 100)
        : null;

      return {
        name: s.name,
        order: s.order_index,
        count: items.length,
        valueBrl: Math.round(valueBrl * 100) / 100,
        valueUsd: Math.round(valueUsd * 100) / 100,
        avgScore: Math.round(avgScore),
        avgDaysInStage: Math.round(avgDaysInStage),
        stuckLeads,
        coolingLeads,
        historicalConversionRate,
        historicalSampleSize: hist?.total ?? 0,
      };
    });

    const totalLeads = pipeline.length;
    const hotLeads = pipeline.filter((p: any) => Number(p.lead_score || 0) >= 75).length;
    const warmLeads = pipeline.filter((p: any) => {
      const s = Number(p.lead_score || 0);
      return s >= 50 && s < 75;
    }).length;
    const coldLeads = pipeline.filter((p: any) => Number(p.lead_score || 0) < 50).length;

    const pipelineValueBrl = stageSummary.reduce((s, x) => s + x.valueBrl, 0);
    const pipelineValueUsd = stageSummary.reduce((s, x) => s + x.valueUsd, 0);

    // Cooling / stuck globals
    const totalStuck = stageSummary.reduce((s, x) => s + x.stuckLeads, 0);
    const totalCooling = stageSummary.reduce((s, x) => s + x.coolingLeads, 0);

    // 4) Lead age distribution (days since pipeline entry)
    const leadAges = pipeline
      .filter((p: any) => p.moved_at)
      .map((p: any) => (Date.now() - new Date(p.moved_at).getTime()) / DAY_MS);
    const avgLeadAge = leadAges.length
      ? Math.round(leadAges.reduce((a, b) => a + b, 0) / leadAges.length)
      : 0;
    const newLeads = leadAges.filter((d) => d < 7).length; // muito novos
    const oldLeads = leadAges.filter((d) => d > 60).length; // muito velhos

    // 5) Chatwoot activity
    const leadsWithChatwoot = pipeline.filter(
      (p: any) => p.chatwoot_conversation_id || p.notes?.includes("Chatwoot"),
    ).length;

    // 6) Proposal signals
    const proposalStats = {
      total: proposals.length,
      sent: proposals.filter((p) => p.status === "sent").length,
      viewed: proposals.filter((p) => p.status === "viewed").length,
      accepted: proposals.filter((p) => p.status === "accepted").length,
      rejected: proposals.filter((p) => p.status === "rejected").length,
    };
    const acceptanceRate = proposalStats.total > 0
      ? Math.round((proposalStats.accepted / proposalStats.total) * 100)
      : null;

    // Pipeline leads with active proposals
    const leadsWithActiveProposal = pipeline.filter((p: any) => {
      const cid = p.cliente?.id;
      if (!cid) return false;
      const props = proposalsByClient.get(cid) ?? [];
      return props.some((pr) => ["sent", "viewed"].includes(pr.status));
    }).length;

    // 7) Follow-up signals
    const followupStats = {
      scheduled: followups.filter((f) => f.status === "scheduled" || f.status === "pending").length,
      sent: followups.filter((f) => f.status === "sent" || f.status === "completed").length,
      converted: followups.filter((f) => f.conversion_status === "converted").length,
    };
    const leadsWithScheduledFollowup = pipeline.filter((p: any) => {
      const cid = p.cliente?.id;
      if (!cid) return false;
      const fs = followupsByClient.get(cid) ?? [];
      return fs.some((f) => ["scheduled", "pending"].includes(f.status));
    }).length;

    // 8) Avg ticket per product (last 90 days closed)
    const productMap = new Map<string, { count: number; totalBrl: number; totalUsd: number }>();
    for (const c of recentClosed) {
      const prod = c.cliente?.produto || "—";
      const v = Number(c.cliente?.valor || 0);
      const m = (c.cliente?.moeda || "BRL").toUpperCase();
      const cur = productMap.get(prod) ?? { count: 0, totalBrl: 0, totalUsd: 0 };
      cur.count += 1;
      if (m === "BRL") cur.totalBrl += v;
      else if (m === "USD") cur.totalUsd += v;
      productMap.set(prod, cur);
    }
    const productTickets = Array.from(productMap.entries())
      .map(([produto, v]) => ({
        produto,
        deals: v.count,
        avgTicketBrl: v.count ? Math.round((v.totalBrl / v.count) * 100) / 100 : 0,
        avgTicketUsd: v.count ? Math.round((v.totalUsd / v.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.deals - a.deals)
      .slice(0, 8);

    // 9) Historical revenue
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

    // 10) Seasonality (current month index + simple Brazilian sales context)
    const monthIdx = now.getMonth(); // 0..11
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    // Heuristic seasonality factor (1.0 = média, >1 forte, <1 fraco)
    const seasonalityMap: Record<number, { factor: number; note: string }> = {
      0: { factor: 0.85, note: "Janeiro: pós-festas, vendas mais lentas." },
      1: { factor: 0.95, note: "Fevereiro: retomada gradual, Carnaval pode atrapalhar." },
      2: { factor: 1.05, note: "Março: fim de Q1, fechamento de metas." },
      3: { factor: 1.0, note: "Abril: ritmo normal." },
      4: { factor: 1.05, note: "Maio: bom mês, Dia das Mães." },
      5: { factor: 1.1, note: "Junho: fim de semestre, pressão por metas." },
      6: { factor: 0.95, note: "Julho: férias escolares, B2B desacelera." },
      7: { factor: 1.05, note: "Agosto: retomada forte." },
      8: { factor: 1.05, note: "Setembro: bom mês comercial." },
      9: { factor: 1.1, note: "Outubro: pré-Black Friday, aquecimento." },
      10: { factor: 1.25, note: "Novembro: Black Friday, pico de vendas." },
      11: { factor: 0.9, note: "Dezembro: festas, vendas caem na 2ª quinzena." },
    };
    const seasonality = seasonalityMap[monthIdx];

    // Period: current month
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysIntoMonth = now.getDate();
    const daysInMonth = periodEnd.getDate();
    const monthProgress = Math.round((daysIntoMonth / daysInMonth) * 100);

    const summaryForAI = {
      currentDate: now.toISOString().slice(0, 10),
      currentMonth: monthNames[monthIdx],
      monthProgress: `${monthProgress}% do mês atual (dia ${daysIntoMonth} de ${daysInMonth})`,
      seasonality: {
        month: monthNames[monthIdx],
        factor: seasonality.factor,
        note: seasonality.note,
      },
      pipelineOverview: {
        totalLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        pipelineValueBrl,
        pipelineValueUsd,
        avgLeadAgeDays: avgLeadAge,
        newLeads_lt7d: newLeads,
        oldLeads_gt60d: oldLeads,
        stuckLeads_gt30dInStage: totalStuck,
        coolingLeads_noInteraction14d: totalCooling,
        leadsWithChatwootActivity: leadsWithChatwoot,
      },
      stagesSummary: stageSummary,
      proposalSignals: {
        last90d: proposalStats,
        acceptanceRate_pct: acceptanceRate,
        leadsInPipelineWithActiveProposal: leadsWithActiveProposal,
      },
      followupSignals: {
        last90d: followupStats,
        leadsInPipelineWithScheduledFollowup: leadsWithScheduledFollowup,
      },
      productTickets_last90d: productTickets,
      historical90d: {
        closedDeals: closedCount,
        revenueBrl: Math.round(closedRevenueBrl * 100) / 100,
        revenueUsd: Math.round(closedRevenueUsd * 100) / 100,
        monthlyAvgBrl: Math.round(monthlyAvgBrl * 100) / 100,
        monthlyAvgUsd: Math.round(monthlyAvgUsd * 100) / 100,
      },
    };

    // 11) Call Lovable AI with enriched prompt
    const systemPrompt = `Você é um analista de vendas sênior especializado em forecasting para CRMs B2B.
Sua tarefa: prever quanto a empresa vai fechar (converter em receita) ATÉ O FIM DO MÊS ATUAL com base nos dados abaixo.

USE OS DADOS REAIS, NÃO CHUTE:
- "historicalConversionRate" por estágio é a taxa de conversão REAL observada (últimos 365 dias). Se disponível e com sample >= 5, use-a em vez de chutar.
- "stuckLeads_gt30dInStage" indica leads parados — descontar agressivamente da previsão.
- "coolingLeads_noInteraction14d" indica leads esfriando — reduzir probabilidade.
- "seasonality.factor" é o multiplicador histórico do mês atual (1.0 = média). Aplique-o à projeção.
- "proposalSignals": leads com proposta visualizada/enviada têm probabilidade alta. Use a "acceptanceRate_pct" como âncora.
- "followupSignals": leads com follow-up agendado têm mais chance.
- "leadsWithChatwootActivity": engajamento ativo aumenta probabilidade.
- "productTickets_last90d": use o ticket médio real por produto para estimar receita.
- "newLeads_lt7d" são leads muito novos (dificilmente fecham no mês). "oldLeads_gt60d" são leads frios (probabilidade baixa).
- "monthProgress": se já passou >70% do mês, só leads MUITO quentes (hot + proposta aceita/visualizada) podem fechar.

REGRAS:
1. Seja realista, não otimista. Prefira subestimar.
2. Use a média histórica mensal (historical90d.monthlyAvgBrl/Usd) como âncora de sanidade — a previsão dificilmente deve exceder 1.5x essa média.
3. Confidence reflete: tamanho de amostra histórica, consistência dos dados, quantidade de leads quentes com proposta ativa.
4. Reasoning DEVE citar números concretos (taxa real, quantidade de leads stuck, fator de sazonalidade etc).

Responda em português brasileiro.`;

    const userPrompt = `Analise estes dados enriquecidos do pipeline e gere a previsão para ${monthNames[monthIdx]}:\n\n${JSON.stringify(summaryForAI, null, 2)}`;

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
                description: "Submit the structured sales forecast for the current month.",
                parameters: {
                  type: "object",
                  properties: {
                    predicted_revenue_brl: {
                      type: "number",
                      description: "Receita prevista em BRL para o restante do mês.",
                    },
                    predicted_revenue_usd: {
                      type: "number",
                      description: "Receita prevista em USD para o restante do mês.",
                    },
                    confidence_pct: {
                      type: "integer",
                      description: "Nível de confiança da previsão de 0 a 100.",
                    },
                    reasoning: {
                      type: "string",
                      description: "Explicação (4-6 frases) citando NÚMEROS CONCRETOS dos dados (taxas reais, sazonalidade, leads stuck/cooling etc).",
                    },
                    recommended_actions: {
                      type: "array",
                      items: { type: "string" },
                      description: "Ações recomendadas (3-5 itens), priorizando leads stuck/cooling e propostas visualizadas.",
                    },
                    risks: {
                      type: "array",
                      items: { type: "string" },
                      description: "Principais riscos identificados (2-4 itens), citando dados.",
                    },
                    opportunities: {
                      type: "array",
                      items: { type: "string" },
                      description: "Oportunidades concretas (2-4 itens), citando leads/propostas/produtos específicos.",
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
          JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace Lovable." }),
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

    // 12) Persist
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sales-forecast error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
