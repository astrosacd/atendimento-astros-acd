import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Backend não configurado" }, 500);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return json({ error: "Texto ausente" }, 400);
    if (text.length > 2500) return json({ error: "Resposta longa demais para voz" }, 400);

    const admin = createClient(url, serviceKey);
    const { data: rows, error: configError } = await admin
      .from("ligacoes_ia_config")
      .select("config_key, config_value");
    if (configError) return json({ error: configError.message }, 500);

    const config: Record<string, string> = {};
    for (const row of rows ?? []) config[row.config_key] = row.config_value ?? "";

    const apiKey = config.elevenlabs_api_key || Deno.env.get("ELEVENLABS_API_KEY");
    const voiceId = config.elevenlabs_default_voice_id?.trim();
    if (!apiKey) return json({ error: "Chave do ElevenLabs não configurada em Ligações IA" }, 400);
    if (!voiceId) return json({ error: "Voz padrão não configurada em Ligações IA" }, 400);

    const modelId = config.elevenlabs_model || "eleven_turbo_v2_5";
    const voiceSettings = {
      stability: Number.parseFloat(config.voice_stability || "0.5"),
      similarity_boost: Number.parseFloat(config.voice_similarity || "0.75"),
      speed: Number.parseFloat(config.voice_speed || "1.0"),
    };

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey.trim(), "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: modelId, voice_settings: voiceSettings }),
      },
    );

    if (!upstream.ok || !upstream.body) {
      const details = await upstream.text().catch(() => "");
      console.error(`ElevenLabs TTS [${upstream.status}]: ${details}`);
      return json({ error: `Falha ao gerar voz (${upstream.status})`, details }, upstream.status || 502);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Astro-Voice-Id": voiceId,
      },
    });
  } catch (error) {
    console.error("astro-tts error", error);
    return json({ error: (error as Error).message }, 500);
  }
});