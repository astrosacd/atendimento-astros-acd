import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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

    const { phone, mediaType, clientName } = await req.json().catch(() => ({}));
    const phoneStr = String(phone || "").replace(/\D/g, "");
    const type = mediaType === "video" ? "video" : "audio";

    if (!phoneStr || phoneStr.length < 10) {
      return new Response(JSON.stringify({ error: "Número inválido (use DDD + número)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ error: "Evolution API não configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let mediaUrl = type === "audio" ? config.ghost_audio_url : config.ghost_video_url;
    const isDynamic = type === "audio" && (config as any).ghost_mode_type === 'dynamic';

    if (isDynamic) {
      // Generate audio on the fly
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('proposals-elevenlabs-tts', {
        body: { 
          text: (config as any).tts_text?.replace('{{nome_cliente}}', clientName || 'Cliente'),
          voiceId: (config as any).elevenlabs_voice_id,
          save: true 
        }
      });
      if (ttsError || ttsData?.error) {
        return new Response(JSON.stringify({ error: `TTS: ${ttsError?.message || ttsData?.error}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      mediaUrl = ttsData.url;
    }

    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: `Nenhum ${type} configurado no Modo Ghost` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      : { number: cleanNumber, media: mediaUrl, mediaType: "video", caption: "🧪 Teste do Modo Ghost", delay: 1200 };

    const res = await fetch(urlBase + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": config.evolution_api_key },
      body: JSON.stringify(body),
    });

    const respText = await res.text();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Evolution: ${respText}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, sentTo: cleanNumber, type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
