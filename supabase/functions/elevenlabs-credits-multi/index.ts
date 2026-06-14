// Returns ElevenLabs character usage/limit for ALL configured sources (Ligações IA + Propostas).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SourceResult = {
  source: "ligacoes_ia" | "propostas";
  label: string;
  configured: boolean;
  used: number;
  limit: number;
  remaining: number;
  pct: number;
  tier: string | null;
  status: string | null;
  next_reset_unix: number | null;
  error?: string;
};

async function fetchSubscription(apiKey: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `ElevenLabs (${res.status}): ${err.substring(0, 200)}` };
    }
    return { ok: true, data: await res.json() };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao consultar ElevenLabs" };
  }
}

function buildResult(
  source: SourceResult["source"],
  label: string,
  configured: boolean,
  sub?: any,
  error?: string,
): SourceResult {
  if (!configured) {
    return { source, label, configured: false, used: 0, limit: 0, remaining: 0, pct: 0, tier: null, status: null, next_reset_unix: null };
  }
  if (error || !sub) {
    return { source, label, configured: true, used: 0, limit: 0, remaining: 0, pct: 0, tier: null, status: null, next_reset_unix: null, error };
  }
  const used = sub.character_count ?? 0;
  const limit = sub.character_limit ?? 0;
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  return {
    source,
    label,
    configured: true,
    used,
    limit,
    remaining,
    pct,
    tier: sub.tier ?? null,
    status: sub.status ?? null,
    next_reset_unix: sub.next_character_count_reset_unix ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Source 1: Ligações IA
    const { data: ligCfg } = await supabase
      .from("ligacoes_ia_config")
      .select("config_value")
      .eq("config_key", "elevenlabs_api_key")
      .maybeSingle();
    const ligKey = (ligCfg?.config_value || "").trim();

    // Source 2: Propostas (proposal_send_config.elevenlabs_api_key)
    const { data: propCfg } = await supabase
      .from("proposal_send_config")
      .select("elevenlabs_api_key")
      .limit(1)
      .maybeSingle();
    const propKey = ((propCfg as any)?.elevenlabs_api_key || "").trim();

    const [ligSub, propSub] = await Promise.all([
      ligKey ? fetchSubscription(ligKey) : Promise.resolve({ ok: false, error: undefined }),
      propKey ? fetchSubscription(propKey) : Promise.resolve({ ok: false, error: undefined }),
    ]);

    const sources: SourceResult[] = [
      buildResult("ligacoes_ia", "Ligações IA", !!ligKey, ligSub.ok ? ligSub.data : undefined, ligKey ? (ligSub.ok ? undefined : ligSub.error) : undefined),
      buildResult("propostas", "Propostas (Voz IA)", !!propKey, propSub.ok ? propSub.data : undefined, propKey ? (propSub.ok ? undefined : propSub.error) : undefined),
    ];

    return new Response(JSON.stringify({ sources }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
