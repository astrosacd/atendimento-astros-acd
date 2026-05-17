// Generates (or fetches from cache) TTS audio via ElevenLabs and stores in Cloud Storage.
// Returns a signed URL to the MP3 that can be passed to Wavoip.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function interpolate(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { roteiro_id, variables = {}, preview_text, preview_voice_id } = await req.json();

    // Load config
    const { data: configRows } = await supabase.from("ligacoes_ia_config").select("config_key, config_value");
    const cfg: Record<string, string> = {};
    (configRows ?? []).forEach((r: any) => cfg[r.config_key] = r.config_value ?? "");

    let texto = preview_text as string | undefined;
    let voiceId = preview_voice_id || cfg.elevenlabs_default_voice_id;
    let roteiro: any = null;

    if (roteiro_id) {
      const { data: r } = await supabase.from("ligacoes_ia_roteiros").select("*").eq("id", roteiro_id).single();
      if (!r) return new Response(JSON.stringify({ error: "Roteiro não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      roteiro = r;
      texto = interpolate(r.texto, variables);
      voiceId = r.voice_id || voiceId;
    }

    if (!texto) return new Response(JSON.stringify({ error: "Texto ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const modelId = cfg.elevenlabs_model || "eleven_multilingual_v2";
    const voiceSettings = {
      stability: parseFloat(cfg.voice_stability || "0.5"),
      similarity_boost: parseFloat(cfg.voice_similarity || "0.75"),
      speed: parseFloat(cfg.voice_speed || "1.0"),
      ...(roteiro?.voice_settings || {}),
    };

    const cacheHash = await sha256(`${voiceId}|${modelId}|${JSON.stringify(voiceSettings)}|${texto}`);

    // Check cache
    const { data: cached } = await supabase
      .from("ligacoes_ia_audios_cache")
      .select("*").eq("cache_hash", cacheHash).maybeSingle();

    let storagePath: string;
    let audioCacheId: string;
    let durationSeconds: number | null = null;
    let sizeBytes: number | null = null;

    if (cached) {
      storagePath = cached.storage_path;
      audioCacheId = cached.id;
      await supabase.from("ligacoes_ia_audios_cache")
        .update({ hit_count: cached.hit_count + 1, last_used_at: new Date().toISOString() })
        .eq("id", cached.id);
    } else {
      const apiKey = cfg.elevenlabs_api_key || Deno.env.get("ELEVENLABS_API_KEY");
      if (!apiKey) return new Response(JSON.stringify({ error: "Chave do ElevenLabs não configurada. Vá em Ligações IA → Configurações." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ text: texto, model_id: modelId, voice_settings: voiceSettings }),
        }
      );
      if (!ttsRes.ok) {
        const err = await ttsRes.text();
        return new Response(JSON.stringify({ error: `ElevenLabs falhou: ${err}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const audioBuf = new Uint8Array(await ttsRes.arrayBuffer());
      sizeBytes = audioBuf.byteLength;
      storagePath = `${cacheHash.slice(0, 2)}/${cacheHash}.mp3`;

      const { error: upErr } = await supabase.storage
        .from("ligacoes-ia-audios")
        .upload(storagePath, audioBuf, { contentType: "audio/mpeg", upsert: true });
      if (upErr) {
        return new Response(JSON.stringify({ error: `Upload falhou: ${upErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: insRow, error: insErr } = await supabase.from("ligacoes_ia_audios_cache").insert({
        cache_hash: cacheHash,
        roteiro_id: roteiro?.id ?? null,
        texto_final: texto,
        voice_id: voiceId,
        storage_path: storagePath,
        size_bytes: sizeBytes,
        characters_count: texto.length,
        hit_count: 1,
      }).select("id").single();
      if (insErr) return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      audioCacheId = insRow.id;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("ligacoes-ia-audios")
      .createSignedUrl(storagePath, 60 * 60 * 24); // 24h
    if (signErr) return new Response(JSON.stringify({ error: signErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({
      audio_cache_id: audioCacheId,
      signed_url: signed.signedUrl,
      cache_hit: !!cached,
      texto_final: texto,
      voice_id: voiceId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
