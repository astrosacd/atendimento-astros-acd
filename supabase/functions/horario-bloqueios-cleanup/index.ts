// Cron-driven cleanup: deletes expired blockages on EXTERNAL Supabase
// and logs each deletion in the LOCAL bloqueios_historico table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Bloqueio {
  id: number;
  data: string;
  dia_todo: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
}

// Returns YYYY-MM-DD and HH:MM:SS in São Paulo timezone
function nowSP() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}:${get("second")}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const source = body?.source === "manual" ? "manual" : "cron";

    const local = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: cfg, error: cfgErr } = await local
      .from("horario_cleanup_config")
      .select("external_url, external_anon_key, enabled")
      .eq("id", 1)
      .maybeSingle();

    if (cfgErr) throw cfgErr;
    if (!cfg?.external_url || !cfg?.external_anon_key) {
      return new Response(JSON.stringify({ ok: false, error: "Conexão externa não configurada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (source === "cron" && cfg.enabled === false) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "cron disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const external = createClient(cfg.external_url, cfg.external_anon_key, { auth: { persistSession: false } });

    const { date: hoje, time: agora } = nowSP();

    const { data: lista, error: listErr } = await external
      .from("bloqueios")
      .select("id,data,dia_todo,hora_inicio,hora_fim,motivo")
      .lte("data", hoje);
    if (listErr) throw listErr;

    const vencidos: Bloqueio[] = (lista || []).filter((b: Bloqueio) => {
      if (b.data < hoje) return true; // qualquer bloqueio de dia anterior
      if (b.data === hoje) {
        // parcial vencido se hora_fim já passou
        if (!b.dia_todo && b.hora_fim && b.hora_fim <= agora) return true;
      }
      return false;
    });

    let deleted = 0;
    const erros: string[] = [];
    for (const b of vencidos) {
      const { error: delErr } = await external.from("bloqueios").delete().eq("id", b.id);
      if (delErr) { erros.push(`#${b.id}: ${delErr.message}`); continue; }
      deleted++;
      await local.from("bloqueios_historico").insert({
        bloqueio_id: b.id,
        acao: "excluido",
        origem: source,
        user_id: null,
        user_nome: source === "cron" ? "Cron automático" : "Execução manual",
        user_email: null,
        data_bloqueio: b.data,
        dia_todo: b.dia_todo,
        hora_inicio: b.hora_inicio,
        hora_fim: b.hora_fim,
        motivo: b.motivo,
        dados_antes: b as any,
      });
    }

    await local.from("horario_cleanup_config")
      .update({ last_run_at: new Date().toISOString(), last_run_deleted: deleted })
      .eq("id", 1);

    return new Response(JSON.stringify({ ok: true, deleted, total_vencidos: vencidos.length, erros, source, hoje, agora }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
