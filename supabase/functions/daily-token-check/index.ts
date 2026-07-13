// Cron diário passivo: notifica gestores via WhatsApp quando token Instagram
// expira em menos de 7 dias (ou já expirou). NÃO tenta renovar — apenas alerta.
// Complementa `instagram-token-auto-refresh` (que renova) e `system-health-check`
// (que exibe status no dashboard).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALERT_THRESHOLD_DAYS = 7;
const NOTIFY_COOLDOWN_HOURS = 24; // evita spam se rodar mais de 1x/dia

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
};

async function sendWhatsApp(
  supabase: ReturnType<typeof createClient>,
  numbers: string[],
  message: string,
) {
  if (!numbers?.length) return;
  const { data: instance } = await supabase
    .from("billing_whatsapp_instances")
    .select("api_url, api_key, instance_name")
    .eq("is_active", true)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!instance?.api_url || !instance?.api_key || !instance?.instance_name) {
    console.warn("[daily-token-check] Nenhuma instância Evolution ativa");
    return;
  }

  for (const number of numbers) {
    const clean = (number || "").replace(/\D/g, "");
    if (!clean) continue;
    try {
      const res = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: instance.api_key as string },
        body: JSON.stringify({ number: clean, text: message, delay: 1200 }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error(`[daily-token-check] WA falhou ${clean} [${res.status}]: ${t}`);
      }
    } catch (e) {
      console.error(`[daily-token-check] WA erro ${clean}:`, e);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const log = async (
    user_id: string | null,
    status: string,
    message: string,
    metadata: Record<string, unknown> = {},
  ) => {
    try {
      await supabase.from("instagram_notification_logs").insert({
        user_id,
        event_type: "token_expiry_alert",
        status,
        channel: "whatsapp",
        target: null,
        message,
        metadata,
      });
    } catch (e) {
      console.error("[daily-token-check] log fail:", e);
    }
  };

  try {
    const { data: rows, error } = await supabase
      .from("instagram_settings")
      .select("user_id, account_username, token_expires_at, manager_numbers, notify_whatsapp, last_renewal_notification_at, access_token");

    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];
    const cooldownMs = NOTIFY_COOLDOWN_HOURS * 3600 * 1000;
    const now = Date.now();

    for (const row of rows ?? []) {
      const days = daysUntil(row.token_expires_at);
      if (!row.access_token || days === null) {
        results.push({ user: row.user_id, status: "skipped", reason: "no_token_or_expiry" });
        continue;
      }
      if (days > ALERT_THRESHOLD_DAYS) {
        results.push({ user: row.user_id, status: "ok", days_left: days });
        continue;
      }

      const lastNotif = row.last_renewal_notification_at ? new Date(row.last_renewal_notification_at as string).getTime() : 0;
      if (now - lastNotif < cooldownMs) {
        results.push({ user: row.user_id, status: "skipped", reason: "recent_notification" });
        continue;
      }

      const username = row.account_username || row.user_id;
      const msg = days < 0
        ? `*🚨 Token Instagram EXPIRADO*\n\n👤 ${username}\n📅 Expirou há ${Math.abs(days)} dia(s).\n\nRenove manualmente no painel /instagram do CRM.`
        : `*⚠️ Token Instagram vai expirar*\n\n👤 ${username}\n⏳ Faltam *${days} dia(s)* para expirar.\n\nA renovação automática tentará renovar. Se falhar, renove manualmente no /instagram.`;

      if (row.notify_whatsapp) {
        await sendWhatsApp(supabase, (row.manager_numbers as string[]) || [], msg);
        await log(row.user_id as string, "sent", `Alerta enviado — ${days} dia(s) restantes`, { username, days_left: days });
      }

      await supabase
        .from("instagram_settings")
        .update({ last_renewal_notification_at: new Date().toISOString() })
        .eq("user_id", row.user_id as string);

      results.push({ user: row.user_id, status: "alerted", days_left: days });
    }

    const summary = {
      total: results.length,
      alerted: results.filter((r) => r.status === "alerted").length,
      ok: results.filter((r) => r.status === "ok").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    };
    console.log("[daily-token-check] Summary:", summary);
    return json({ success: true, summary, results });
  } catch (error: any) {
    console.error("[daily-token-check] Fatal:", error);
    return json({ success: false, error: error?.message || String(error) }, 500);
  }
});
