// MCP Server — Streamable HTTP transport spec-compliant (mcp-lite)
// Compatible with Claude Desktop, MCP Inspector, OpenClaw, e qualquer cliente MCP moderno.
import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultInputSchema(toolType: string) {
  if (toolType === "sql_query") {
    return {
      type: "object",
      properties: { query: { type: "string", description: "Consulta SQL a executar" } },
      required: ["query"],
      additionalProperties: false,
    };
  }
  if (toolType === "table_write") {
    return {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["insert", "update", "delete"] },
        values: { type: "object", description: "Colunas e valores para insert/update" },
        match: { type: "object", description: "Filtro (obrigatório para update/delete)" },
        confirm: { type: "boolean", description: "Deve ser true para executar a escrita" },
      },
      required: ["operation", "confirm"],
      additionalProperties: false,
    };
  }
  return {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["select", "count"],
        default: "select",
        description: "Use 'count' para saber o TOTAL exato de registros. Use 'select' para listar linhas (sempre vem com total_count também).",
      },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 2000,
        default: 500,
        description: "Máximo de linhas retornadas. Padrão 500. Suba até 2000 se precisar varrer a tabela inteira.",
      },
      filter: {
        type: "object",
        description: "Filtros simples coluna=valor. Ex: {\"cobranca_ativa\": true}. Aplica .eq() em cada par.",
      },
      order_by: { type: "string", description: "Coluna para ordenar (ex: 'data_renovacao')." },
      order_desc: { type: "boolean", description: "true para ordem decrescente.", default: false },
    },
    required: [],
    additionalProperties: false,
  };
}

function normalizeInputSchema(schema: unknown, toolType: string) {
  if (!isJsonObject(schema) || schema.type !== "object" || !isJsonObject(schema.properties)) {
    return defaultInputSchema(toolType);
  }
  return { ...schema, required: Array.isArray(schema.required) ? schema.required : [] };
}

function hashKey(key: string | null): string {
  if (!key) return "anon";
  return key.length <= 8 ? "***" : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

async function writeAudit(entry: {
  caller_api_key_hint: string;
  caller_ip: string | null;
  tool_name: string;
  tool_type: string;
  payload: unknown;
  result_summary: unknown;
  success: boolean;
  error_message: string | null;
  duration_ms: number;
}) {
  try {
    await admin().from("mcp_audit_log").insert({
      ...entry,
      method: "tools/call",
    });
  } catch (e) {
    console.error("audit log error", e);
  }
}

// ---------- Auth + config gate ----------
async function authorize(req: Request): Promise<Response | null> {
  const apiKey = req.headers.get("x-api-key");
  const supabase = admin();

  const { data: configs, error } = await supabase
    .from("mcp_config")
    .select("config_key, config_value")
    .in("config_key", ["mcp_api_key", "mcp_enabled"]);

  if (error || !configs) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const enabled = configs.find((c) => c.config_key === "mcp_enabled")?.config_value === "true";
  const validKey = configs.find((c) => c.config_key === "mcp_api_key")?.config_value;

  if (!enabled) {
    return new Response(JSON.stringify({ error: "MCP Server is disabled" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!apiKey || apiKey !== validKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

// ---------- Build a fresh MCP server with tools from DB ----------
async function buildServer(ctx: { keyHint: string; ip: string | null }): Promise<McpServer> {
  const supabase = admin();
  const server = new McpServer({ name: "atendimento-astros-mcp", version: "2.1.0" });

  const { data: tools } = await supabase.from("mcp_tools").select("*").eq("enabled", true);

  for (const t of tools ?? []) {
    const cfg = t.configuration ?? {};
    const inputSchema = normalizeInputSchema(cfg.inputSchema, t.tool_type);

    server.tool(t.name, {
      description: t.description ?? `Tool ${t.name}`,
      inputSchema,
      handler: async (args: Record<string, unknown>) => {
        const start = Date.now();
        let success = true;
        let errorMessage: string | null = null;
        let resultSummary: unknown = null;
        let result: unknown;

        try {
          if (t.tool_type === "table_access") {
            const table = cfg.table as string;
            const operations: string[] = cfg.operations ?? [];
            const op = String(args?.operation ?? "select");

            if (op === "count") {
              const { count, error } = await supabase
                .from(table)
                .select("*", { count: "exact", head: true });
              if (error) throw error;
              result = { table, count };
              resultSummary = { count };
            } else if (operations.includes("select") || operations.includes("read")) {
              const limit = Math.min(Math.max(Number(args?.limit ?? 50), 1), 1000);
              const { data, error } = await supabase.from(table).select("*").limit(limit);
              if (error) throw error;
              result = data;
              resultSummary = { rows: Array.isArray(data) ? data.length : 0, limit };
            } else {
              throw new Error(`Operação "${op}" não permitida para a tool "${t.name}".`);
            }
          } else if (t.tool_type === "sql_query") {
            const query = String(args?.query ?? "");
            if (!query) throw new Error("Parâmetro 'query' obrigatório");
            const { data, error } = await supabase.rpc("execute_sql", { sql_query: query });
            if (error) throw error;
            result = data;
            resultSummary = { length: Array.isArray(data) ? data.length : 1 };
          } else if (t.tool_type === "table_write") {
            // Validação estrita para escritas
            const table = cfg.table as string;
            const allowedOps: string[] = cfg.operations ?? [];
            const allowedCols: string[] | undefined = cfg.allowed_columns;
            const requireConfirm: boolean = cfg.require_confirm !== false; // default true

            const op = String(args?.operation ?? "");
            if (!["insert", "update", "delete"].includes(op)) {
              throw new Error(`operation inválida: "${op}" (use insert|update|delete)`);
            }
            if (!allowedOps.includes(op)) {
              throw new Error(`Operação "${op}" não habilitada na configuração da tool "${t.name}".`);
            }
            if (requireConfirm && args?.confirm !== true) {
              throw new Error(`Confirmação obrigatória: passe { "confirm": true } para executar ${op} em ${table}.`);
            }

            const values = isJsonObject(args?.values) ? args!.values as Record<string, unknown> : undefined;
            const match = isJsonObject(args?.match) ? args!.match as Record<string, unknown> : undefined;

            if (allowedCols && values) {
              const violation = Object.keys(values).find((k) => !allowedCols.includes(k));
              if (violation) throw new Error(`Coluna "${violation}" não permitida na tool "${t.name}".`);
            }

            if (op === "insert") {
              if (!values) throw new Error("Parâmetro 'values' obrigatório para insert.");
              const { data, error } = await supabase.from(table).insert(values).select();
              if (error) throw error;
              result = data;
              resultSummary = { inserted: Array.isArray(data) ? data.length : 0 };
            } else if (op === "update") {
              if (!values) throw new Error("Parâmetro 'values' obrigatório para update.");
              if (!match || Object.keys(match).length === 0) {
                throw new Error("Parâmetro 'match' obrigatório para update (proteção contra update global).");
              }
              let q = supabase.from(table).update(values);
              for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never);
              const { data, error } = await q.select();
              if (error) throw error;
              result = data;
              resultSummary = { updated: Array.isArray(data) ? data.length : 0 };
            } else if (op === "delete") {
              if (!match || Object.keys(match).length === 0) {
                throw new Error("Parâmetro 'match' obrigatório para delete (proteção contra delete global).");
              }
              let q = supabase.from(table).delete();
              for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never);
              const { data, error } = await q.select();
              if (error) throw error;
              result = data;
              resultSummary = { deleted: Array.isArray(data) ? data.length : 0 };
            }
          } else {
            throw new Error(`tool_type desconhecido: ${t.tool_type}. Suportados: table_access, sql_query, table_write.`);
          }

          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          success = false;
          errorMessage = (err as Error).message;
          return { isError: true, content: [{ type: "text", text: `Erro: ${errorMessage}` }] };
        } finally {
          await writeAudit({
            caller_api_key_hint: ctx.keyHint,
            caller_ip: ctx.ip,
            tool_name: t.name,
            tool_type: t.tool_type,
            payload: args ?? {},
            result_summary: resultSummary,
            success,
            error_message: errorMessage,
            duration_ms: Date.now() - start,
          });
        }
      },
    });
  }

  return server;
}

// ---------- Hono app ----------
const app = new Hono();

app.options("/*", () => new Response(null, { status: 204, headers: corsHeaders }));

app.all("/*", async (c) => {
  const req = c.req.raw;
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const denied = await authorize(req);
  if (denied) return denied;

  const keyHint = hashKey(req.headers.get("x-api-key"));
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

  try {
    const server = await buildServer({ keyHint, ip });
    const transport = new StreamableHttpTransport();
    const handler = transport.bind(server);
    const response = await handler(req);

    const merged = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v);
    return new Response(response.body, { status: response.status, headers: merged });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

Deno.serve(app.fetch);
