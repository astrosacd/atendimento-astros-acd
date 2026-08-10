// ASTRO — transcrição de voz (STT) via Lovable AI Gateway.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!req.headers.get("Authorization")) return json({ error: "Não autorizado" }, 401);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Arquivo de áudio ausente" }, 400);
    if (file.size < 2048) return json({ error: "Gravação vazia. Fale um pouco mais." }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ error: "Áudio muito longo" }, 400);

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", file, "recording.wav");
    upstream.append("language", "pt");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("STT error", res.status, t);
      return json({ error: `Falha na transcrição: ${t.slice(0, 300)}` }, res.status);
    }

    const data = await res.json();
    return json({ text: (data?.text ?? "").toString().trim() });
  } catch (e) {
    console.error("astro-stt error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
