import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate user
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'generate');
    let text = String(body?.text || "").trim();
    const voiceId = String(body?.voiceId || ""); // Optional if using config default
    const save = Boolean(body?.save);
    const overrideKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

    if (action === 'generate' && (!text || text.length > 1000)) {
      return new Response(JSON.stringify({ error: "Texto inválido (1-1000 caracteres)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Read API key from proposal_send_config
    const { data: config } = await supabase
      .from("proposal_send_config")
      .select("elevenlabs_api_key, tts_text, elevenlabs_voice_id")
      .limit(1)
      .maybeSingle();

    const apiKey = overrideKey || config?.elevenlabs_api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Chave da ElevenLabs não configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve voice and text for generation
    const finalVoiceId = voiceId || config?.elevenlabs_voice_id || "JBFqnCBsd6RMkjVDRZzb";
    const finalText = text || config?.tts_text || "";

    if (action === 'generate' && (!finalText || finalText.length > 5000)) {
      return new Response(JSON.stringify({ error: "Texto inválido (1-5000 caracteres)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // List voices action
    if (action === 'list_voices') {
      const vRes = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
        headers: { "xi-api-key": apiKey },
      });
      if (!vRes.ok) {
        const errText = await vRes.text();
        return new Response(JSON.stringify({ error: `ElevenLabs: ${errText}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const vJson = await vRes.json();
      const voices = (vJson.voices || []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels || {},
        preview_url: v.preview_url,
      }));
      return new Response(JSON.stringify({ voices }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate TTS
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: finalText,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
        }),
      },
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      return new Response(JSON.stringify({ error: `ElevenLabs: ${errText}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const audioBuf = await ttsRes.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuf);

    if (save) {
      // Upload to storage
      const path = `ghost/elevenlabs-${Date.now()}.mp3`;
      const { error: upErr } = await supabase.storage
        .from("proposal-images")
        .upload(path, audioBytes, { upsert: true, contentType: "audio/mpeg" });
      if (upErr) {
        return new Response(JSON.stringify({ error: `Upload: ${upErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: pub } = supabase.storage.from("proposal-images").getPublicUrl(path);
      return new Response(JSON.stringify({ url: pub.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return preview as base64
    const base64 = base64Encode(audioBytes);
    return new Response(JSON.stringify({ audioContent: base64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
