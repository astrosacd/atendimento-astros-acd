// Enqueues SMS in `sms_agendados` based on `sms_cobranca_config`.
// Called daily by cron, or manually from the admin UI (Sync today).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-temp-access-token, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function todayInBrazil() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function tipoDFromDays(days: number) {
  if (days === 0) return "D+0";
  return days > 0 ? `D+${days}` : `D-${Math.abs(days)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  
  const hojeStr = todayInBrazil();
  let dias: number[] = [];
  let triggeredBy = "cron";

  const writeLog = async (status: string, enqueued: number, scanned: number, message: string) => {
    await supabase.from("sms_cobranca_logs").insert({
      status, 
      enqueued, 
      scanned,
      dias_processados: dias, 
      message, 
      triggered_by: triggeredBy,
    }).then(() => {}, (e) => console.error("Error writing log:", e));
  };

  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    triggeredBy = force ? "manual" : "cron";

    const { data: cfg } = await supabase.from("sms_cobranca_config").select("*").limit(1).maybeSingle();
    if (!cfg || (!cfg.enabled && !force)) {
      await writeLog("skipped", 0, 0, "Cron desativado");
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const defaultTemplateId: string | null = cfg?.template_id ?? null;

    // Load ALL active billing templates
    const { data: allTemplates } = await supabase
      .from("sms_templates")
      .select("id, nome, categoria")
      .eq("ativo", true)
      .in("categoria", ["cobranca", "recuperacao", "geral"])
      .order("categoria", { ascending: true })
      .order("created_at", { ascending: true });

    let fallbackTemplateId: string | null = defaultTemplateId ?? (allTemplates?.[0]?.id ?? null);

    if (!fallbackTemplateId) {
      await writeLog("error", 0, 0, "Nenhum template ativo encontrado");
      return new Response(JSON.stringify({ ok: false, error: "Nenhum template ativo encontrado. Crie ou ative um template antes de sincronizar." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    dias = (cfg?.dias_disparo?.length ? cfg.dias_disparo : [5]);
    if (dias.length === 0) {
      await writeLog("skipped", 0, 0, "Sem dias de disparo configurados");
      return new Response(JSON.stringify({ ok: true, skipped: "sem dias_disparo" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let total = 0;
    let scanned = 0;
    
    for (const d of dias) {
      const targetStr = addDays(hojeStr, -d);

      let q = supabase.from("clientes").select("id, numero, cobranca_ativa, data_renovacao").not("numero", "is", null).neq("numero", "").eq("data_renovacao", targetStr);
      if (cfg.apenas_cobranca_ativa) q = q.eq("cobranca_ativa", true);
      
      const { data: clientes, error } = await q;
      if (error) continue;
      if (!clientes?.length) continue;
      scanned += clientes.length;

      const rows = clientes
        .filter((c: any) => c.numero)
        .map((c: any) => {
          return {
            cliente_id: c.id,
            template_id: fallbackTemplateId,
            dia_alvo: hojeStr,
            tipo_d: tipoDFromDays(d),
            status: "pendente",
          };
        });
        
      if (!rows.length) continue;

      const { data: existing } = await supabase
        .from("sms_agendados")
        .select("cliente_id, tipo_d")
        .eq("dia_alvo", hojeStr)
        .is("campanha_id", null);
        
      const existingKeys = new Set((existing ?? []).map((r: any) => `${r.cliente_id}|${r.tipo_d}`));
      const newRows = rows.filter((r: any) => !existingKeys.has(`${r.cliente_id}|${r.tipo_d}`));
      
      if (!newRows.length) continue;

      const { error: insErr } = await supabase.from("sms_agendados").insert(newRows);
      if (!insErr) total += newRows.length;
    }

    const msg = total === 0
      ? (scanned === 0 ? "Nenhum cliente com vencimento nos dias configurados" : `${scanned} cliente(s) já estavam na fila`)
      : `${total} SMS enfileirado(s) (${scanned} cliente(s) encontrado(s))`;

    await writeLog("success", total, scanned, msg);

    return new Response(JSON.stringify({ ok: true, enqueued: total, scanned, dia: hojeStr, dias_processados: dias }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    
  } catch (e) {
    const errMsg = (e as Error).message;
    await writeLog("error", 0, 0, errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
