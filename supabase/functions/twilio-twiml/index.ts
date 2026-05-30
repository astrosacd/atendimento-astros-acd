import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const audioUrl = url.searchParams.get("audio_url");
  const histId = url.searchParams.get("hist_id");

  // If it's a Twilio status callback (usually POST)
  if (req.method === "POST") {
    const formData = await req.formData();
    const callStatus = formData.get("CallStatus")?.toString();
    const callSid = formData.get("CallSid")?.toString();
    const duration = formData.get("CallDuration")?.toString();

    console.log(`[twilio-twiml] Status callback: ${callSid} - ${callStatus} - ${histId}`);

    if (histId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let status = "finalizada";
      if (callStatus === "busy") status = "ocupado";
      else if (callStatus === "no-answer") status = "nao_atendeu";
      else if (callStatus === "canceled") status = "cancelada";
      else if (callStatus === "failed") status = "erro";
      else if (callStatus === "in-progress") status = "atendida";
      else if (callStatus === "completed") status = "finalizada";

      await supabase
        .from("ligacoes_ia_historico")
        .update({ 
          status, 
          duration_seconds: duration ? parseInt(duration) : undefined,
          wavoip_call_id: callSid // Using this field to store Twilio Call SID too
        })
        .eq("id", histId);
    }

    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // If it's a request for TwiML (usually GET when call starts)
  if (audioUrl) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${decodeURIComponent(audioUrl)}</Play>
</Response>`;

    return new Response(xml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  return new Response("Invalid request", { status: 400 });
});
