// ASTRO — assistente de voz do CRM. Responde perguntas e executa ações via tool calling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `Você é o ASTRO, assistente de voz da Astros Comunicação Digital, integrado ao CRM.

REGRAS:
- Responda SEMPRE em português brasileiro.
- Suas respostas são faladas em voz alta: seja curto, direto e natural. Máximo 3 frases, sem markdown, sem listas com bullets, sem emojis, sem links.
- Números e valores: fale de forma natural (ex: "mil duzentos e cinquenta reais").
- Use as ferramentas disponíveis para consultar dados reais do CRM antes de responder. Nunca invente dados.
- Para AÇÕES que alteram dados (criar cliente, atualizar cliente, agendar reunião, criar tarefa, disparar cobrança), confirme verbalmente com o usuário antes de executar, a menos que ele já tenha confirmado explicitamente na mensagem.
- Se faltar informação obrigatória para uma ação, pergunte apenas o que falta.`;

const tools = [
  {
    type: "function",
    function: {
      name: "buscar_clientes",
      description: "Busca clientes no CRM por nome, número de WhatsApp, e-mail, produto ou CPF.",
      parameters: {
        type: "object",
        properties: {
          termo: { type: "string", description: "Texto de busca. Vazio para listar os últimos." },
          limite: { type: "number", description: "Máximo de resultados (padrão 10)." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estatisticas_crm",
      description: "Retorna métricas gerais: total de clientes, ativos, MRR aproximado, vencimentos próximos e atrasados.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "clientes_por_vencimento",
      description: "Lista clientes por janela de vencimento (renovação).",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "number", description: "Janela em dias a partir de hoje (padrão 7)." },
          atrasados: { type: "boolean", description: "Se true, lista os que já venceram." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proximos_eventos",
      description: "Lista os próximos eventos/reuniões da agenda.",
      parameters: {
        type: "object",
        properties: { limite: { type: "number" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_cliente",
      description: "Cria um novo cliente no CRM. AÇÃO — confirme antes.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          numero: { type: "string", description: "WhatsApp com DDD" },
          email: { type: "string" },
          produto: { type: "string" },
          plano: { type: "string" },
          valor: { type: "number" },
          data_renovacao: { type: "string", description: "YYYY-MM-DD" },
          observacao: { type: "string" },
        },
        required: ["nome", "numero"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_cliente",
      description: "Atualiza campos de um cliente existente. AÇÃO — confirme antes.",
      parameters: {
        type: "object",
        properties: {
          cliente_id: { type: "string", description: "UUID do cliente (use buscar_clientes antes)." },
          nome: { type: "string" },
          numero: { type: "string" },
          email: { type: "string" },
          produto: { type: "string" },
          plano: { type: "string" },
          valor: { type: "number" },
          data_renovacao: { type: "string" },
          observacao: { type: "string" },
        },
        required: ["cliente_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_reuniao",
      description: "Cria um evento na agenda. AÇÃO — confirme antes.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          start_time: { type: "string", description: "ISO 8601 com fuso" },
          duracao_minutos: { type: "number", description: "Padrão 60" },
          client_name: { type: "string" },
          client_phone: { type: "string" },
          description: { type: "string" },
          meeting_type: { type: "string", enum: ["online", "presencial"] },
        },
        required: ["title", "start_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description: "Cria uma tarefa vinculada (ou não) a um cliente. AÇÃO — confirme antes.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          due_date: { type: "string", description: "ISO 8601" },
          cliente_id: { type: "string" },
          priority: { type: "string", enum: ["baixa", "media", "alta"] },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "disparar_cobranca",
      description: "Dispara manualmente o ciclo de cobrança automática. AÇÃO ADMIN — confirme antes.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const { data: isAdmin } = await userClient.rpc("is_admin");

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) return json({ error: "Nenhuma mensagem enviada" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const hoje = new Date().toISOString().slice(0, 10);
    const convo: any[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nData de hoje: ${hoje}. Usuário: ${user.email}. Admin: ${isAdmin ? "sim" : "não"}.` },
      ...messages.map((m: any) => ({ role: m.role, content: String(m.content ?? "") })),
    ];

    const runTool = async (name: string, args: any): Promise<any> => {
      switch (name) {
        case "buscar_clientes": {
          const limite = Math.min(Number(args?.limite) || 10, 25);
          let q = admin.from("clientes")
            .select("id, nome, numero, email, produto, plano, valor, moeda, data_renovacao, cobranca_ativa, tipo")
            .order("created_at", { ascending: false })
            .limit(limite);
          const termo = (args?.termo ?? "").toString().trim();
          if (termo) {
            const t = `%${termo}%`;
            q = q.or(`nome.ilike.${t},numero.ilike.${t},email.ilike.${t},produto.ilike.${t},cpf.ilike.${t}`);
          }
          const { data, error } = await q;
          if (error) throw new Error(error.message);
          return { total: data?.length ?? 0, clientes: data };
        }
        case "estatisticas_crm": {
          const { data, error } = await admin
            .from("clientes")
            .select("valor, cobranca_ativa, data_renovacao, excluir_metricas");
          if (error) throw new Error(error.message);
          const rows = (data ?? []).filter((c: any) => !c.excluir_metricas);
          const ativos = rows.filter((c: any) => c.cobranca_ativa);
          const mrr = ativos.reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
          const hojeD = new Date(hoje);
          const em7 = ativos.filter((c: any) => {
            if (!c.data_renovacao) return false;
            const d = new Date(c.data_renovacao);
            const diff = (d.getTime() - hojeD.getTime()) / 86400000;
            return diff >= 0 && diff <= 7;
          }).length;
          const atrasados = ativos.filter((c: any) => c.data_renovacao && new Date(c.data_renovacao) < hojeD).length;
          return { total_clientes: rows.length, clientes_ativos: ativos.length, mrr_estimado: Math.round(mrr * 100) / 100, vencendo_em_7_dias: em7, atrasados };
        }
        case "clientes_por_vencimento": {
          const dias = Number(args?.dias) || 7;
          const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
          let q = admin.from("clientes")
            .select("id, nome, numero, produto, valor, data_renovacao")
            .eq("cobranca_ativa", true)
            .order("data_renovacao", { ascending: true })
            .limit(25);
          q = args?.atrasados ? q.lt("data_renovacao", hoje) : q.gte("data_renovacao", hoje).lte("data_renovacao", limite);
          const { data, error } = await q;
          if (error) throw new Error(error.message);
          return { total: data?.length ?? 0, clientes: data };
        }
        case "proximos_eventos": {
          const { data, error } = await admin
            .from("calendar_events")
            .select("id, title, start_time, end_time, client_name, status, meeting_type")
            .gte("start_time", new Date().toISOString())
            .neq("status", "cancelled")
            .order("start_time", { ascending: true })
            .limit(Math.min(Number(args?.limite) || 5, 20));
          if (error) throw new Error(error.message);
          return { eventos: data };
        }
        case "criar_cliente": {
          if (!args?.nome || !args?.numero) return { erro: "nome e numero são obrigatórios" };
          const { data, error } = await admin.from("clientes").insert({
            nome: args.nome,
            numero: String(args.numero).replace(/\D/g, ""),
            email: args.email ?? null,
            produto: args.produto ?? null,
            plano: args.plano ?? null,
            valor: args.valor ?? null,
            data_renovacao: args.data_renovacao ?? null,
            observacao: args.observacao ?? null,
            created_by: user.id,
          }).select("id, nome").single();
          if (error) throw new Error(error.message);
          return { sucesso: true, cliente: data };
        }
        case "atualizar_cliente": {
          if (!args?.cliente_id) return { erro: "cliente_id obrigatório" };
          const patch: Record<string, unknown> = {};
          for (const k of ["nome", "numero", "email", "produto", "plano", "valor", "data_renovacao", "observacao"]) {
            if (args[k] !== undefined && args[k] !== null) patch[k] = args[k];
          }
          if (Object.keys(patch).length === 0) return { erro: "nenhum campo para atualizar" };
          const { data, error } = await admin.from("clientes").update(patch).eq("id", args.cliente_id).select("id, nome").single();
          if (error) throw new Error(error.message);
          return { sucesso: true, cliente: data };
        }
        case "agendar_reuniao": {
          const start = new Date(args.start_time);
          if (isNaN(start.getTime())) return { erro: "start_time inválido" };
          const dur = Number(args?.duracao_minutos) || 60;
          const { data, error } = await admin.from("calendar_events").insert({
            title: args.title,
            description: args.description ?? null,
            client_name: args.client_name ?? null,
            client_phone: args.client_phone ?? null,
            start_time: start.toISOString(),
            end_time: new Date(start.getTime() + dur * 60000).toISOString(),
            meeting_type: args.meeting_type === "presencial" ? "presencial" : "online",
            created_by: user.id,
          }).select("id, title, start_time").single();
          if (error) throw new Error(error.message);
          return { sucesso: true, evento: data };
        }
        case "criar_tarefa": {
          const prioridade = ["baixa", "media", "alta"].includes(args?.priority) ? args.priority : "media";
          const { data, error } = await admin.from("client_tasks").insert({
            title: args.title,
            description: args.description ?? null,
            due_date: args.due_date ?? null,
            cliente_id: args.cliente_id ?? null,
            priority: prioridade,
            status: "pendente",
            created_by: user.id,
            created_by_email: user.email,
          }).select("id, title").single();
          if (error) throw new Error(error.message);
          return { sucesso: true, tarefa: data };
        }
        case "disparar_cobranca": {
          if (!isAdmin) return { erro: "Apenas administradores podem disparar cobrança." };
          const res = await fetch(`${SUPABASE_URL}/functions/v1/trigger-billing`, {
            method: "POST",
            headers: { Authorization: authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const txt = await res.text();
          if (!res.ok) return { erro: `Falha ao disparar cobrança: ${txt}` };
          return { sucesso: true, resposta: txt.slice(0, 400) };
        }
        default:
          return { erro: `Ferramenta desconhecida: ${name}` };
      }
    };

    for (let step = 0; step < 6; step++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: convo,
          tools,
          temperature: 0.25,
          max_tokens: 220,
        }),
      });

      if (aiRes.status === 429) return json({ error: "Limite de requisições atingido. Tente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error("AI gateway error", aiRes.status, t);
        return json({ error: `Falha na IA: ${t.slice(0, 300)}` }, 502);
      }

      const data = await aiRes.json();
      const msg = data?.choices?.[0]?.message;
      if (!msg) return json({ error: "Resposta inválida da IA" }, 502);

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        return json({ reply: (msg.content ?? "").toString().trim() || "Desculpe, não consegui responder." });
      }

      convo.push(msg);
      const results = await Promise.all(calls.map(async (call: any) => {
        try {
          const args = JSON.parse(call.function?.arguments || "{}");
          console.log("astro tool:", call.function?.name, args);
          return await runTool(call.function?.name, args);
        } catch (e) {
          return { erro: (e as Error).message };
        }
      }));
      calls.forEach((call: any, index: number) => {
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(results[index]) });
      });
    }

    return json({ reply: "Não consegui concluir a solicitação. Pode reformular?" });
  } catch (e) {
    console.error("astro-assistant error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
