import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-temp-access-token",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Autenticação necessária" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Não autorizado" }, 401);
    }

    // ---- Input ----
    const body = await req.json().catch(() => ({}));
    const { clienteId, mode = "summary", model = "google/gemini-2.5-flash" } =
      body as {
        clienteId?: string;
        mode?: "summary" | "churn";
        model?: string;
      };

    if (!clienteId || typeof clienteId !== "string") {
      return json({ error: "clienteId é obrigatório" }, 400);
    }
    if (!["summary", "churn"].includes(mode)) {
      return json({ error: "mode inválido (summary | churn)" }, 400);
    }

    // ---- Fetch client context (parallel) ----
    const [
      clienteRes,
      historyRes,
      paymentsRes,
      tasksRes,
      followupsRes,
      purchasesRes,
      proposalsRes,
      recoveryRes,
    ] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle(),
      supabase
        .from("client_history")
        .select("action, changed_fields, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("client_payments")
        .select("amount, status, payment_type, billing_date, paid_at")
        .eq("cliente_id", clienteId)
        .order("billing_date", { ascending: false })
        .limit(20),
      supabase
        .from("client_tasks")
        .select("title, status, priority, due_date, completed_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("client_followups")
        .select("produto, channel, status, scheduled_at, conversion_status")
        .eq("cliente_id", clienteId)
        .order("scheduled_at", { ascending: false })
        .limit(15),
      supabase
        .from("client_purchases")
        .select("produto, valor, moeda, data_compra, descricao")
        .eq("cliente_id", clienteId)
        .order("data_compra", { ascending: false })
        .limit(15),
      supabase
        .from("proposals")
        .select("title, status, total_value, currency, created_at, signed_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("client_recovery_attempts")
        .select("canal, status, data_envio, converteu")
        .eq("cliente_id", clienteId)
        .order("data_envio", { ascending: false })
        .limit(10),
    ]);

    const cliente = clienteRes.data;
    if (!cliente) {
      return json({ error: "Cliente não encontrado" }, 404);
    }

    const context = {
      cliente: {
        nome: cliente.nome,
        produto: cliente.produto,
        plano: cliente.plano,
        valor: cliente.valor,
        moeda: cliente.moeda,
        data_renovacao: cliente.data_renovacao,
        cobranca_ativa: cliente.cobranca_ativa,
        ciclo_cobranca: cliente.ciclo_cobranca,
        tags: cliente.tags,
        observacao: cliente.observacao,
        cliente_desde: cliente.created_at,
        tipo_cadastro: cliente.tipo || 'cliente',
        excluir_metricas: cliente.excluir_metricas || false,
      },
      historico_alteracoes: historyRes.data || [],
      pagamentos: paymentsRes.data || [],
      tarefas: tasksRes.data || [],
      followups: followupsRes.data || [],
      compras: purchasesRes.data || [],
      propostas: proposalsRes.data || [],
      tentativas_recuperacao: recoveryRes.data || [],
    };

    // ---- Build prompt ----
    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "summary") {
      systemPrompt = `Você é um assistente de CRM especializado em preparar consultores para reuniões com clientes.
Gere um briefing executivo, claro e objetivo, em português brasileiro.

Estrutura obrigatória (use markdown):
## 👤 Perfil do Cliente
(2-3 linhas com o essencial: produto, plano, tempo de casa)

## 📊 Status Atual
(situação financeira, renovação, cobrança)

## 🎯 Histórico de Engajamento
(propostas, compras, follow-ups, tarefas relevantes)

## ⚠️ Pontos de Atenção
(problemas, atrasos, sinais de alerta — se houver)

## 💡 Recomendações para a Reunião
(3-5 ações práticas e específicas)

Seja conciso. Não invente dados que não estão no contexto.`;

      userPrompt = `Prepare um briefing para reunião com o cliente abaixo.\n\nDados do CRM:\n${JSON.stringify(
        context,
        null,
        2,
      )}`;
    } else {
      systemPrompt = `Você é um analista de Customer Success especializado em prever churn (cancelamento).
Analise os dados do cliente e retorne APENAS um JSON válido (sem markdown, sem texto extra) no formato:

{
  "risco": "baixo" | "medio" | "alto" | "critico",
  "score": <número 0-100, onde 100 = certeza de churn>,
  "principais_sinais": ["sinal 1", "sinal 2", "sinal 3"],
  "fatores_positivos": ["fator 1", "fator 2"],
  "acoes_recomendadas": [
    {"acao": "descrição da ação", "prioridade": "alta|media|baixa", "prazo": "imediato|esta_semana|este_mes"}
  ],
  "resumo_executivo": "2-3 frases explicando o diagnóstico"
}

Critérios de risco:
- Pagamentos atrasados/falhos recentes → +risco
- Múltiplas tentativas de recuperação → +risco
- Tarefas vencidas sem conclusão → +risco
- Cobrança desativada → +risco crítico
- Compras recorrentes e em dia → -risco
- Engajamento alto (propostas aceitas, follow-ups convertidos) → -risco`;

      userPrompt = `Analise o risco de churn deste cliente:\n\n${JSON.stringify(
        context,
        null,
        2,
      )}`;
    }

    // ---- Call Lovable AI ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }

    const aiBody: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    // Force JSON output for churn mode
    if (mode === "churn") {
      aiBody.response_format = { type: "json_object" };
    }

    const aiResponse = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return json(
          { error: "Limite de requisições excedido. Tente novamente em instantes." },
          429,
        );
      }
      if (aiResponse.status === 402) {
        return json(
          { error: "Créditos insuficientes. Adicione créditos ao workspace Lovable." },
          402,
        );
      }
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      return json({ error: "Erro ao comunicar com a IA" }, 500);
    }

    const aiData = await aiResponse.json();
    const content: string = aiData.choices?.[0]?.message?.content ?? "";

    if (mode === "churn") {
      // Parse JSON safely
      let parsed: unknown = null;
      try {
        const cleaned = content
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.error("Falha ao parsear JSON da IA:", content);
        return json(
          { error: "Resposta da IA em formato inválido", raw: content },
          500,
        );
      }
      return json({ mode, analysis: parsed, model });
    }

    return json({ mode, summary: content.trim(), model });
  } catch (error) {
    console.error("client-ai-insights error:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      500,
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
