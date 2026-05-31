import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlForAudio(audioUrl: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${escapeXml(audioUrl)}</Play>
</Response>`;
}

function mapTwilioStatus(callStatus?: string | null) {
  if (callStatus === "initiated" || callStatus === "queued") return "discando";
  if (callStatus === "ringing") return "tocando";
  if (callStatus === "in-progress") return "atendida";
  if (callStatus === "completed") return "finalizada";
  if (callStatus === "busy") return "ocupado";
  if (callStatus === "no-answer") return "nao_atendeu";
  if (callStatus === "canceled") return "cancelada";
  if (callStatus === "failed") return "erro";
  return "atualizado";
}

function mapDialStatus(dialStatus?: string | null) {
  if (dialStatus === "completed") return "finalizada";
  if (dialStatus === "answered" || dialStatus === "in-progress") return "atendida";
  if (dialStatus === "busy") return "ocupado";
  if (dialStatus === "no-answer") return "nao_atendeu";
  if (dialStatus === "canceled") return "cancelada";
  if (dialStatus === "failed") return "erro";
  return "atualizado";
}

function terminalStatus(status: string) {
  return ["finalizada", "nao_atendeu", "ocupado", "erro", "cancelada"].includes(status);
}

function twimlForBridge(customerNumber: string, histId?: string | null) {
  const baseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-twiml`;
  const actionUrl = `${baseUrl}?hist_id=${encodeURIComponent(histId ?? "")}&twilio_event=dial_action`;
  const numberStatusUrl = `${baseUrl}?hist_id=${encodeURIComponent(histId ?? "")}&twilio_event=dial_number`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="pt-BR">Conectando você ao cliente agora. Aguarde na linha.</Say>
    <Dial action="${escapeXml(actionUrl)}" method="POST" timeout="35" answerOnBridge="true">
        <Number statusCallback="${escapeXml(numberStatusUrl)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${escapeXml(customerNumber)}</Number>
    </Dial>
</Response>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const audioUrl = url.searchParams.get("audio_url");
  const bridgeTo = url.searchParams.get("bridge_to");
  const histId = url.searchParams.get("hist_id");

  // Twilio may request the call TwiML via GET or POST. 
  // If it's a voice instruction request:
  if (audioUrl) {
    return new Response(twimlForAudio(audioUrl), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }

  if (bridgeTo) {
    const customerNumber = bridgeTo.startsWith("+") ? bridgeTo : `+${bridgeTo.replace(/\D/g, "")}`;
    return new Response(twimlForBridge(customerNumber, histId), {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }

  // If it's a Twilio status callback (usually POST)
  if (req.method === "POST") {
    const formData = await req.formData();
    const callStatus = formData.get("CallStatus")?.toString();
    const callSid = formData.get("CallSid")?.toString();
    const duration = formData.get("CallDuration")?.toString();
    const formPayload = Object.fromEntries(formData.entries());

    console.log(`[twilio-twiml] Status callback: ${callSid} - ${callStatus} - ${histId}`);

    if (histId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const status = mapTwilioStatus(callStatus);
      const terminal = ["finalizada", "nao_atendeu", "ocupado", "erro", "cancelada"].includes(status);

      await supabase
        .from("ligacoes_ia_historico")
        .update({ 
          status,
          duration_seconds: duration ? parseInt(duration) : undefined,
          wavoip_call_id: callSid,
          raw_payload: formPayload,
          answered_at: status === "atendida" ? new Date().toISOString() : undefined,
          ended_at: terminal ? new Date().toISOString() : undefined,
        })
        .eq("id", histId);
    }

    return new Response("<Response></Response>", {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }

  return new Response("Invalid request", { status: 400, headers: corsHeaders });
});
