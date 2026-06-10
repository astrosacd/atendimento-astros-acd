// Returns ElevenLabs character usage/limit for the configured API key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data } = await supabase
      .from("ligacoes_ia_config")
      .select("config_value")
      .eq("config_key", "elevenlabs_api_key")
      .maybeSingle();
    const apiKey = data?.config_value?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key do ElevenLabs não configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: `ElevenLabs (${res.status}): ${err}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sub = await res.json();
    const used = sub.character_count ?? 0;
    const limit = sub.character_limit ?? 0;
    const remaining = Math.max(0, limit - used);
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;

    return new Response(JSON.stringify({
      used, limit, remaining, pct,
      tier: sub.tier ?? null,
      status: sub.status ?? null,
      next_reset_unix: sub.next_character_count_reset_unix ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
