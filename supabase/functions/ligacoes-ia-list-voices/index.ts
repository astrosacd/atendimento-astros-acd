// Lists ElevenLabs voices for the configured (or provided) API key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const parseElevenLabsError = (raw: string, status: number) => {
  try {
    const parsed = JSON.parse(raw);
    const detail = parsed?.detail || parsed;
    const message = detail?.message || detail?.status || raw;
    return `ElevenLabs (${status}): ${message}`;
  } catch {
    return `ElevenLabs (${status}): ${raw || "erro ao validar a API Key"}`;
  }
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

    let apiKey: string | undefined;
    try {
      const body = await req.json();
      apiKey = body?.api_key || body?.apiKey;
    } catch { /* no body */ }

    if (!apiKey) {
      const { data } = await supabase
        .from("ligacoes_ia_config")
        .select("config_value")
        .eq("config_key", "elevenlabs_api_key")
        .maybeSingle();
      apiKey = data?.config_value;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key do ElevenLabs não configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    apiKey = apiKey.trim();

    const res = await fetch("https://api.elevenlabs.io/v2/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: parseElevenLabsError(err, res.status) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    const voices = (data.voices ?? []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category, // premade | professional | cloned | generated
      labels: v.labels ?? {},
      preview_url: v.preview_url,
    }));

    return new Response(JSON.stringify({ voices }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
