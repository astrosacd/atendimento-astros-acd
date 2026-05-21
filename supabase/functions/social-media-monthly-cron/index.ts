import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function prevMonthStr() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Config global (cron precisa estar ligado)
    const { data: cfg } = await admin
      .from("social_media_report_config").select("*").limit(1).maybeSingle();

    if (!cfg?.auto_send_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "auto_send_enabled = false" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const todayDay = now.getUTCDate();
    const targetMonth = prevMonthStr();

    // 1) Sync diário (sempre)
    try {
      await fetch(`${supabaseUrl}/functions/v1/social-media-sync-profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-call": "1",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ sync_all: true }),
      });
    } catch (e) {
      console.error("sync error:", e);
    }

    // 2) Para cada perfil cujo report_day == hoje, gerar e enviar
    const { data: profiles } = await admin
      .from("social_media_client_profiles")
      .select("*")
      .eq("is_active", true)
      .eq("auto_send_enabled", true)
      .eq("report_day", todayDay);

    const results: any[] = [];

    for (const p of (profiles || [])) {
      try {
        // Gera relatório do mês anterior
        const genRes = await fetch(`${supabaseUrl}/functions/v1/social-media-generate-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-call": "1",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ profile_id: p.id, month: targetMonth }),
        });
        const genJson = await genRes.json();
        if (!genRes.ok) throw new Error(genJson?.error || `gen HTTP ${genRes.status}`);

        const reportId = genJson?.report?.id;
        if (!reportId) throw new Error("Sem report_id retornado");

        // Envia
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/social-media-send-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-call": "1",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ report_id: reportId }),
        });
        const sendJson = await sendRes.json();
        results.push({ profile_id: p.id, username: p.username, status: "ok", send: sendJson });
      } catch (e: any) {
        results.push({ profile_id: p.id, username: p.username, status: "error", error: e.message });
      }
    }

    return new Response(JSON.stringify({ month: targetMonth, today: todayDay, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("social-media-monthly-cron error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
