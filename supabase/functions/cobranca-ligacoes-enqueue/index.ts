// Enqueues calls in `ligacoes_agendadas` based on `cobranca_ligacao_config`.
// Called daily by cron, or manually from the admin UI (Sync today).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cfg } = await supabase.from("cobranca_ligacao_config").select("*").limit(1).maybeSingle();
    if (!cfg || !cfg.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!cfg.roteiro_id) {
      return new Response(JSON.stringify({ ok: false, error: "roteiro_id não configurado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const dias: number[] = cfg.dias_disparo ?? [];
    if (dias.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "sem dias_disparo" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().slice(0, 10);

    let total = 0;
    for (const d of dias) {
      // target renovation date = hoje - d  (so that data_renovacao + d = hoje)
      const target = new Date(hoje);
      target.setUTCDate(target.getUTCDate() - d);
      const targetStr = target.toISOString().slice(0, 10);

      let q = supabase.from("clientes").select("id, numero, cobranca_ativa").eq("data_renovacao", targetStr).not("numero", "is", null);
      if (cfg.apenas_cobranca_ativa) q = q.eq("cobranca_ativa", true);
      const { data: clientes, error } = await q;
      if (error) continue;
      if (!clientes?.length) continue;

      const tipoD = d === 0 ? "D+0" : d > 0 ? `D+${d}` : `D-${Math.abs(d)}`;
      const rows = clientes
        .filter((c: any) => c.numero)
        .map((c: any) => ({
          cliente_id: c.id,
          roteiro_id: cfg.roteiro_id,
          dia_alvo: hojeStr,
          tipo_d: tipoD,
          status: "pendente",
        }));
      if (!rows.length) continue;

      // upsert with conflict on (cliente_id, dia_alvo, tipo_d) — ignore duplicates
      const { error: insErr, count } = await supabase
        .from("ligacoes_agendadas")
        .upsert(rows, { onConflict: "cliente_id,dia_alvo,tipo_d", ignoreDuplicates: true, count: "exact" });
      if (!insErr) total += count ?? rows.length;
    }

    return new Response(JSON.stringify({ ok: true, enqueued: total, dia: hojeStr }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
