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
      properties: {
        query: { type: "string", description: "Consulta SQL a executar" },
      },
      required: ["query"],
      additionalProperties: false,
    };
  }

  return {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Quantidade máxima de registros retornados (máximo 200)",
        minimum: 1,
        maximum: 200,
        default: 50,
      },
    },
    required: [],
    additionalProperties: false,
  };
}

function normalizeInputSchema(schema: unknown, toolType: string) {
  if (!isJsonObject(schema) || schema.type !== "object" || !isJsonObject(schema.properties)) {
    return defaultInputSchema(toolType);
  }

  return {
    ...schema,
    required: Array.isArray(schema.required) ? schema.required : [],
  };
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
async function buildServer(): Promise<McpServer> {
  const supabase = admin();
  const server = new McpServer({
    name: "atendimento-astros-mcp",
    version: "2.0.0",
  });

  const { data: tools } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("enabled", true);

  for (const t of tools ?? []) {
    const cfg = t.configuration ?? {};
    const inputSchema = normalizeInputSchema(cfg.inputSchema, t.tool_type);

    server.tool(t.name, {
      description: t.description ?? `Tool ${t.name}`,
      inputSchema,
      handler: async (args: Record<string, unknown>) => {
        try {
          let result: unknown;

          if (t.tool_type === "table_access") {
            const table = cfg.table as string;
            const operations: string[] = cfg.operations ?? [];

            if (operations.includes("select") || operations.includes("read")) {
              const limit = Math.min(Number(args?.limit ?? 50), 200);
              const { data, error } = await supabase.from(table).select("*").limit(limit);
              if (error) throw error;
              result = data;
            } else {
              throw new Error(`Operação não suportada via MCP para a tool "${t.name}". Apenas leitura é permitida automaticamente.`);
            }
          } else if (t.tool_type === "sql_query") {
            const query = String(args?.query ?? "");
            if (!query) throw new Error("Parâmetro 'query' obrigatório");
            const { data, error } = await supabase.rpc("execute_sql", { sql_query: query });
            if (error) throw error;
            result = data;
          } else {
            throw new Error(`tool_type desconhecido: ${t.tool_type}`);
          }

          return {
            content: [
              { type: "text", text: JSON.stringify(result, null, 2) },
            ],
          };
        } catch (err) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Erro: ${(err as Error).message}` },
            ],
          };
        }
      },
    });
  }

  return server;
}

// ---------- Hono app ----------
const app = new Hono();

app.options("/*", (c) => {
  return new Response(null, { status: 204, headers: corsHeaders });
});

app.all("/*", async (c) => {
  const req = c.req.raw;

  // Preflight já tratado acima; ainda assim garante CORS:
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth + enabled gate
  const denied = await authorize(req);
  if (denied) return denied;

  try {
    const server = await buildServer();
    const transport = new StreamableHttpTransport();
    const handler = transport.bind(server);
    const response = await handler(req);

    // Merge CORS headers no response final
    const merged = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v);
    return new Response(response.body, {
      status: response.status,
      headers: merged,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

Deno.serve(app.fetch);
