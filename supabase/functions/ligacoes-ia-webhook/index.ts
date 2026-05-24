// Receives Wavoip call status callbacks and updates historico row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

const STATUS_MAP: Record<string, string> = {
  ringing: "tocando",
  answered: "atendida",
  in_progress: "atendida",
  completed: "finalizada",
  no_answer: "nao_atendeu",
  busy: "ocupado",
  failed: "erro",
  rejected: "rejeitada",
  cliente_desligou_antes_audio: "cliente_desligou_antes_audio",
  nao_atendeu: "nao_atendeu",
  finalizada: "finalizada",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const histId = url.searchParams.get("hist_id");
    const body = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const wavoipStatus = body.status || body.event || "";
    const mapped = STATUS_MAP[wavoipStatus] || wavoipStatus || "atualizado";

    const update: Record<string, any> = {
      status: mapped,
      raw_payload: body,
    };
    if (body.duration_seconds != null || body.duration != null) update.duration_seconds = body.duration_seconds ?? body.duration;
    if (body.cost_cents) update.cost_cents = body.cost_cents;
    if (body.observacao) update.error_message = body.observacao;
    if (mapped === "atendida" && !update.answered_at) update.answered_at = new Date().toISOString();
    if (["finalizada", "nao_atendeu", "ocupado", "erro", "rejeitada", "cliente_desligou_antes_audio"].includes(mapped)) {
      update.ended_at = new Date().toISOString();
    }

    let query = supabase.from("ligacoes_ia_historico").update(update);
    if (histId) query = query.eq("id", histId);
    else if (body.call_id) query = query.eq("wavoip_call_id", body.call_id);
    else return new Response(JSON.stringify({ error: "Missing identifier" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error } = await query;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
