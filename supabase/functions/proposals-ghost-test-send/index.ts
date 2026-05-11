import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { phone, mediaType } = await req.json().catch(() => ({}));
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
      .select("evolution_api_url, evolution_api_key, evolution_instance_name, ghost_audio_url, ghost_video_url")
      .limit(1)
      .maybeSingle();

    if (!config?.evolution_api_url || !config?.evolution_api_key || !config?.evolution_instance_name) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mediaUrl = type === "audio" ? config.ghost_audio_url : config.ghost_video_url;
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
