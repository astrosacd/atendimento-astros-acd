import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface ScoreResult {
  score: number;
  faixa: "ouro" | "prata" | "bronze" | "risco";
  justificativa: string;
  desconto_sugerido: number;
  fatores: Record<string, any>;
}

function calcFaixa(score: number): "ouro" | "prata" | "bronze" | "risco" {
  if (score >= 800) return "ouro";
  if (score >= 600) return "prata";
  if (score >= 400) return "bronze";
  return "risco";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const clienteId: string | undefined = body.cliente_id;
    const recalcAll: boolean = !!body.recalc_all;

    // Buscar clientes alvo
    let clientesQuery = supabase
      .from("clientes")
      .select("id, nome, produto, valor, moeda, data_renovacao, created_at, cobranca_ativa, ciclo_cobranca");

    if (clienteId) {
      clientesQuery = clientesQuery.eq("id", clienteId);
    }

    const { data: clientes, error: clientesErr } = await clientesQuery;
    if (clientesErr) throw clientesErr;
    if (!clientes || clientes.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum cliente encontrado", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    let processed = 0;
    const errors: string[] = [];

    for (const cliente of clientes) {
      try {
        // Coletar dados de comportamento do cliente
        const [paymentsRes, billingRes] = await Promise.all([
          supabase
            .from("client_payments")
            .select("status, amount, paid_at, billing_date, created_at")
            .eq("cliente_id", cliente.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("billing_logs")
            .select("status, message_type, sent_at")
            .eq("cliente_id", cliente.id)
            .order("sent_at", { ascending: false })
            .limit(50),
        ]);

        const payments = paymentsRes.data || [];
        const billings = billingRes.data || [];

        // Métricas básicas
        const totalPayments = payments.length;
        const paidCount = payments.filter((p) => p.status === "approved" || p.status === "paid").length;
        const errorBillings = billings.filter((b) => b.status === "error").length;
        const tempoCasa = cliente.created_at
          ? Math.floor((Date.now() - new Date(cliente.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const ticketMedio =
          payments.length > 0
            ? payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) / payments.length
            : Number(cliente.valor) || 0;

        // Calcular atrasos: pagamentos feitos depois do billing_date
        let atrasoMedio = 0;
        let atrasos = 0;
        for (const p of payments) {
          if (p.paid_at && p.billing_date) {
            const dias = Math.floor(
              (new Date(p.paid_at).getTime() - new Date(p.billing_date).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (dias > 0) {
              atrasos++;
              atrasoMedio += dias;
            }
          }
        }
        if (atrasos > 0) atrasoMedio = atrasoMedio / atrasos;

        const fatores = {
          tempo_casa_dias: tempoCasa,
          total_pagamentos: totalPayments,
          pagamentos_aprovados: paidCount,
          taxa_pagamento: totalPayments > 0 ? Math.round((paidCount / totalPayments) * 100) : null,
          ticket_medio: Math.round(ticketMedio * 100) / 100,
          atrasos_count: atrasos,
          atraso_medio_dias: Math.round(atrasoMedio),
          erros_cobranca: errorBillings,
          cobranca_ativa: cliente.cobranca_ativa,
          ciclo: cliente.ciclo_cobranca,
        };

        // Pedir análise para a IA
        const prompt = `Você é um analista de risco financeiro de um CRM. Analise os dados abaixo de um cliente e gere um SCORE de 0 a 1000 (estilo Serasa interno).

Critérios:
- 800-1000 (Ouro): excelente histórico, paga em dia, longo tempo de casa, ticket alto
- 600-799 (Prata): bom histórico, atrasos pontuais, recorrência confiável
- 400-599 (Bronze): histórico mediano, atrasos frequentes ou pouco tempo de casa
- 0-399 (Risco): muitos atrasos, erros de cobrança, baixo engajamento

Dados do cliente "${cliente.nome}" (produto: ${cliente.produto}):
${JSON.stringify(fatores, null, 2)}

Responda APENAS com JSON válido no formato:
{"score": <0-1000>, "justificativa": "<texto curto explicando, máx 200 caracteres>", "desconto_sugerido": <0-30 percentual recomendado>}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é um analista de crédito. Responda apenas em JSON válido." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          if (aiResponse.status === 429) throw new Error("Rate limit excedido na IA");
          if (aiResponse.status === 402) throw new Error("Créditos esgotados na IA");
          throw new Error(`AI error: ${errText}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "{}";
        const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);

        const score = Math.max(0, Math.min(1000, Math.round(parsed.score || 500)));
        const result: ScoreResult = {
          score,
          faixa: calcFaixa(score),
          justificativa: parsed.justificativa || "Score calculado automaticamente",
          desconto_sugerido: Math.max(0, Math.min(30, Number(parsed.desconto_sugerido) || 0)),
          fatores,
        };

        // Buscar score anterior para detectar queda
        const { data: scoreAnterior } = await supabase
          .from("client_scores")
          .select("faixa, score")
          .eq("cliente_id", cliente.id)
          .maybeSingle();

        // Upsert
        const { error: upsertErr } = await supabase
          .from("client_scores")
          .upsert(
            {
              cliente_id: cliente.id,
              score: result.score,
              faixa: result.faixa,
              justificativa: result.justificativa,
              desconto_sugerido: result.desconto_sugerido,
              fatores: result.fatores,
              calculated_at: new Date().toISOString(),
            },
            { onConflict: "cliente_id" }
          );

        if (upsertErr) throw upsertErr;

        // Detectar queda de Ouro/Prata e gerar alerta para todos os admins
        const faixasRanking = { ouro: 4, prata: 3, bronze: 2, risco: 1 };
        if (
          scoreAnterior &&
          (scoreAnterior.faixa === "ouro" || scoreAnterior.faixa === "prata") &&
          faixasRanking[result.faixa] < faixasRanking[scoreAnterior.faixa as keyof typeof faixasRanking]
        ) {
          // Buscar admins
          const { data: admins } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");

          if (admins && admins.length > 0) {
            const alerts = admins.map((a) => ({
              user_id: a.user_id,
              alert_type: "score_drop",
              title: `📉 Cliente ${cliente.nome} caiu de faixa`,
              message: `De ${scoreAnterior.faixa.toUpperCase()} (${scoreAnterior.score}) para ${result.faixa.toUpperCase()} (${result.score}). Possível sinal de churn.`,
              metadata: { cliente_id: cliente.id, score_anterior: scoreAnterior.score, score_novo: result.score },
            }));
            await supabase.from("user_security_alerts").insert(alerts);
          }
        }

        processed++;
      } catch (e: any) {
        console.error(`Erro no cliente ${cliente.id}:`, e.message);
        errors.push(`${cliente.nome}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Scores calculados",
        processed,
        total: clientes.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro geral:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
