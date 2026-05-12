import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const { phone, mediaType, clientName, mediaUrl: mediaUrlOverride } = await req.json().catch(() => ({}));
    const phoneStr = String(phone || "").replace(/\D/g, "");
    const type = mediaType === "video" ? "video" : "audio";
    const overrideUrl = typeof mediaUrlOverride === "string" && /^https?:\/\//i.test(mediaUrlOverride.trim()) && mediaUrlOverride.trim().length <= 2000
      ? mediaUrlOverride.trim()
      : "";

    if (!phoneStr || phoneStr.length < 10) {
      return jsonResponse({ error: "Número inválido (use DDD + número)" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: config } = await supabase
      .from("proposal_send_config")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name, ghost_audio_url, ghost_video_url, ghost_mode_type, tts_text, elevenlabs_voice_id")
      .limit(1)
      .maybeSingle();

    if (!config?.evolution_api_url || !config?.evolution_api_key || !config?.evolution_instance_name) {
      return jsonResponse({ error: "Evolution API não configurada" });
    }

    let mediaUrl = overrideUrl || (type === "audio" ? config.ghost_audio_url : config.ghost_video_url);
    const isDynamic = type === "audio" && (config as any).ghost_mode_type === 'dynamic';

    if (isDynamic) {
      // Generate audio on the fly
      const ttsRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/proposals-elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          text: (config as any).tts_text?.replace('{{nome_cliente}}', clientName || 'Cliente'),
          voiceId: (config as any).elevenlabs_voice_id,
          save: true,
        }),
      });
      const ttsText = await ttsRes.text();
      const ttsData = ttsText ? JSON.parse(ttsText) : {};
      if (!ttsRes.ok || ttsData?.error) {
        return jsonResponse({ error: `TTS: ${ttsData?.error || `Falha ao gerar áudio (${ttsRes.status})`}`, code: ttsData?.code });
      }
      mediaUrl = ttsData.url;
    }

    if (!mediaUrl) {
      return jsonResponse({ error: `Nenhum ${type} configurado no Modo Ghost` });
    }

    let cleanNumber = phoneStr;
    if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
      cleanNumber = "55" + cleanNumber;
    }

    const urlBase = `${config.evolution_api_url}/message`;
    const endpoint = type === "audio"
      ? `/sendWhatsAppAudio/${config.evolution_instance_name}`
      : `/sendMedia/${config.evolution_instance_name}`;

    const body: any = type === "audio"
      ? { number: cleanNumber, audio: mediaUrl, delay: 1200, encoding: true }
      : { number: cleanNumber, mediatype: "video", media: mediaUrl, mimetype: "video/mp4", caption: "🧪 Teste do Modo Ghost", delay: 1200 };

    let finalEndpoint = endpoint;
    let finalBody = body;
    let res = await fetch(urlBase + finalEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": config.evolution_api_key },
      body: JSON.stringify(finalBody),
    });

    let respText = await res.text();
    if (!res.ok && type === "audio" && respText.includes('mediatype')) {
      finalEndpoint = `/sendMedia/${config.evolution_instance_name}`;
      finalBody = { number: cleanNumber, mediatype: "audio", media: mediaUrl, mimetype: "audio/mpeg", delay: 1200 };
      res = await fetch(urlBase + finalEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": config.evolution_api_key },
        body: JSON.stringify(finalBody),
      });
      respText = await res.text();
    }
    if (!res.ok) {
      return jsonResponse({ error: `Evolution (${res.status}): ${respText}` });
    }

    return jsonResponse({ ok: true, sentTo: cleanNumber, type, endpoint: finalEndpoint });
  } catch (e: any) {
    return jsonResponse({ error: e.message });
  }
});
