// Cron diário: renova tokens Instagram/Meta próximos do vencimento (<10 dias)
// e notifica os gestores via WhatsApp em sucesso ou falha.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RENEW_THRESHOLD_DAYS = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.floor(ms / 86_400_000);
};

const isInstagramToken = (token: string) => token.startsWith("IGA");

interface RefreshResult {
  user_id: string;
  username: string | null;
  status: "renewed" | "skipped" | "failed" | "already_expired";
  message: string;
  old_expires_at: string | null;
  new_expires_at: string | null;
  days_left_before: number | null;
}

async function refreshInstagramToken(token: string) {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status} ao renovar token Instagram`);
  }
  return {
    access_token: data.access_token as string,
    expires_in: data.expires_in as number, // seconds
  };
}

async function refreshFacebookToken(token: string, appId: string, appSecret: string) {
  const url = `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status} ao renovar token Facebook`);
  }
  return {
    access_token: data.access_token as string,
    expires_in: data.expires_in as number,
  };
}

async function sendWhatsAppNotification(
  supabase: ReturnType<typeof createClient>,
  numbers: string[],
  message: string,
) {
  if (!numbers?.length) {
    console.warn("[auto-refresh] Sem números de gestores — pulando WhatsApp");
    return;
  }

  // Instância ativa da Evolution API (mesma fonte usada por billing-cron / weekly-renewals)
  const { data: instance, error: instErr } = await supabase
    .from("billing_whatsapp_instances")
    .select("api_url, api_key, instance_name")
    .eq("is_active", true)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (instErr || !instance) {
    console.warn("[auto-refresh] Nenhuma instância Evolution ativa encontrada", instErr);
    return;
  }

  const apiUrl = instance.api_url;
  const apiKey = instance.api_key;
  const instanceName = instance.instance_name;

  if (!apiUrl || !apiKey || !instanceName) {
    console.warn("[auto-refresh] Instância Evolution incompleta — pulando WhatsApp", { apiUrl: !!apiUrl, apiKey: !!apiKey, instanceName: !!instanceName });
    return;
  }

  console.log(`[auto-refresh] Enviando WhatsApp via ${instanceName} para ${numbers.length} número(s)`);

  for (const number of numbers) {
    const clean = (number || "").replace(/\D/g, "");
    if (!clean) continue;
    try {
      const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: clean, text: message, delay: 1200 }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[auto-refresh] WA falhou para ${clean} [${res.status}]: ${body}`);
      } else {
        console.log(`[auto-refresh] WA enviado com sucesso para ${clean}`);
      }
    } catch (e) {
      console.error(`[auto-refresh] Falha WA para ${clean}:`, e);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const logEvent = async (
    user_id: string | null,
    event_type: string,
    status: string,
    message: string,
    metadata: Record<string, unknown> = {},
    target?: string,
  ) => {
    try {
      await supabase.from("instagram_notification_logs").insert({
        user_id, event_type, status,
        channel: event_type === "token_refresh" ? "system" : "whatsapp",
        target: target ?? null,
        message, metadata,
      });
    } catch (e) {
      console.error("[auto-refresh] log fail:", e);
    }
  };

  try {
    const { data: rows, error } = await supabase
      .from("instagram_settings")
      .select("user_id, access_token, app_id, app_secret, token_expires_at, account_username, manager_numbers, notify_whatsapp");

    if (error) throw error;

    const results: RefreshResult[] = [];

    for (const row of rows ?? []) {
      const username = row.account_username || null;
      const oldExp = row.token_expires_at;
      const days = daysUntil(oldExp);

      const baseResult: RefreshResult = {
        user_id: row.user_id,
        username,
        status: "skipped",
        message: "",
        old_expires_at: oldExp,
        new_expires_at: oldExp,
        days_left_before: days,
      };

      if (!row.access_token) {
        results.push({ ...baseResult, message: "Sem token configurado" });
        continue;
      }

      // Já expirado: não dá pra renovar, só avisa
      if (days !== null && days < 0) {
        const msg = `*⚠️ Token Instagram EXPIRADO*\n\n👤 ${username || row.user_id}\n📅 Expirou há ${Math.abs(days)} dia(s).\n\nÉ necessário gerar um novo token manualmente no Meta Developers e colar no CRM.`;
        if (row.notify_whatsapp) await sendWhatsAppNotification(supabase, row.manager_numbers || [], msg);
        results.push({ ...baseResult, status: "already_expired", message: "Token expirado — renovação manual necessária" });
        continue;
      }

      // Fora da janela de renovação
      if (days !== null && days > RENEW_THRESHOLD_DAYS) {
        results.push({ ...baseResult, message: `Faltam ${days} dias — fora da janela de renovação` });
        continue;
      }

      // Tentar renovar
      try {
        let refreshed: { access_token: string; expires_in: number };

        if (isInstagramToken(row.access_token)) {
          refreshed = await refreshInstagramToken(row.access_token);
        } else {
          if (!row.app_id || !row.app_secret) {
            throw new Error("App ID/Secret ausentes para token Facebook");
          }
          refreshed = await refreshFacebookToken(row.access_token, row.app_id, row.app_secret);
        }

        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

        await supabase
          .from("instagram_settings")
          .update({
            access_token: refreshed.access_token,
            token_expires_at: newExpiresAt,
            updated_at: new Date().toISOString(),
            last_renewal_notification_at: new Date().toISOString(),
          })
          .eq("user_id", row.user_id);

        const dateStr = new Date(newExpiresAt).toLocaleDateString("pt-BR");
        if (row.notify_whatsapp) {
          const msg = `*✅ Token Instagram renovado automaticamente*\n\n👤 ${username || row.user_id}\n📅 Nova validade: *${dateStr}*\n⏳ Antes faltavam: ${days ?? "?"} dia(s)\n\nNenhuma ação manual é necessária.`;
          await sendWhatsAppNotification(supabase, row.manager_numbers || [], msg);
        }

        results.push({
          ...baseResult,
          status: "renewed",
          message: `Renovado até ${dateStr}`,
          new_expires_at: newExpiresAt,
        });
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.error(`[auto-refresh] Falha user ${row.user_id}:`, errMsg);

        if (row.notify_whatsapp) {
          const msg = `*❌ Falha ao renovar token Instagram*\n\n👤 ${username || row.user_id}\n⏳ Faltam ${days ?? "?"} dia(s) para expirar.\n\n*Motivo:* ${errMsg}\n\nVerifique o token no painel /instagram do CRM.`;
          await sendWhatsAppNotification(supabase, row.manager_numbers || [], msg);
        }

        results.push({ ...baseResult, status: "failed", message: errMsg });
      }
    }

    const summary = {
      total: results.length,
      renewed: results.filter((r) => r.status === "renewed").length,
      failed: results.filter((r) => r.status === "failed").length,
      expired: results.filter((r) => r.status === "already_expired").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    };

    console.log("[auto-refresh] Summary:", summary);
    return json({ success: true, summary, results });
  } catch (error: any) {
    console.error("[auto-refresh] Fatal:", error);
    return json({ success: false, error: error?.message || String(error) }, 500);
  }
});
