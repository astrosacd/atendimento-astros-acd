import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const formatGraphError = (result: any, actionLabel: string) => {
  const metaError = result?.error;
  if (!metaError) return `Erro ao ${actionLabel} token: resposta inválida da Meta`;

  const details = [metaError.message, metaError.type, metaError.code ? `código ${metaError.code}` : null]
    .filter(Boolean)
    .join(" — ");

  return `Erro ao ${actionLabel} token na Meta: ${details || JSON.stringify(metaError)}`;
};

const optionalString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isMetaTokenError = (message: string) =>
  message.includes("Erro ao depurar token na Meta") || message.includes("Erro ao renovar token na Meta");

const normalizeId = (value: unknown) => (typeof value === "string" ? value.replace(/\D/g, "") : "");

const fetchJson = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  return { response, payload };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const { data: settings, error: settingsError } = await supabase
      .from('instagram_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) throw new Error("Erro ao carregar configurações do Instagram");

    const access_token = optionalString(body.access_token) || settings?.access_token || "";
    const app_id = optionalString(body.app_id) || settings?.app_id || "";
    const app_secret = optionalString(body.app_secret) || settings?.app_secret || "";
    const ig_user_id = optionalString(body.ig_user_id) || settings?.ig_user_id || "";
    const manager_numbers = settings?.manager_numbers || [];
    const notify_whatsapp = settings?.notify_whatsapp || false;
    const renewal_webhook_url = settings?.renewal_webhook_url || "";
    if (!access_token) throw new Error("Token de acesso não configurado");

    const graphHost = "https://graph.facebook.com/v23.0";
    const instagramGraphHost = "https://graph.instagram.com/v23.0";

    if (action === "debug") {
      if (!app_id || !app_secret) {
        throw new Error("App ID e App Secret são necessários para depurar o token");
      }

      const appAccessToken = `${app_id}|${app_secret}`;
      const debugUrl = `${graphHost}/debug_token?input_token=${encodeURIComponent(access_token)}&access_token=${encodeURIComponent(appAccessToken)}`;
      
      const { response: res, payload: result } = await fetchJson(debugUrl);

      if (!res.ok) {
        const instagramMeUrl = `${instagramGraphHost}/me?fields=user_id,username&access_token=${encodeURIComponent(access_token)}`;
        const { response: igRes, payload: igResult } = await fetchJson(instagramMeUrl);

        if (!igRes.ok) {
          throw new Error(formatGraphError(result, "depurar"));
        }

        const tokenUserId = normalizeId(igResult?.user_id || igResult?.id);
        const expectedUserId = normalizeId(ig_user_id);

        if (expectedUserId && tokenUserId && expectedUserId !== tokenUserId) {
          return jsonResponse({
            success: false,
            meta_error: true,
            fallback: true,
            error: `Token válido, mas pertence ao Instagram ID ${tokenUserId}. O Instagram User ID informado é ${expectedUserId}.`,
            data: {
              is_valid: false,
              user_id: tokenUserId,
              username: igResult?.username,
              validation_method: "instagram_login_me",
            },
          });
        }

        return jsonResponse({
          success: true,
          fallback: true,
          data: {
            is_valid: true,
            expires_at: null,
            scopes: [],
            user_id: tokenUserId || null,
            username: igResult?.username || null,
            validation_method: "instagram_login_me",
          },
        });
      }

      const { data } = result;
      const expiresAt = data.data_access_expires_at || data.expires_at;
      
      let expirationDate = null;
      if (expiresAt) {
        expirationDate = new Date(expiresAt * 1000).toISOString();
      }

      // Update the database with the expiration date
      if (expirationDate && settings) {
        await supabase
          .from('instagram_settings')
          .update({ token_expires_at: expirationDate })
          .eq('user_id', user.id);
      }

      return jsonResponse({ 
        success: true, 
        data: {
          is_valid: data.is_valid,
          expires_at: expirationDate,
          scopes: data.scopes,
          user_id: data.user_id
        } 
      });
    }

    if (action === "refresh") {
      const isIgToken = access_token.startsWith("IGA");
      let newAccessToken = access_token;
      let expirationDate: string | null = null;

      if (isIgToken) {
        // Instagram Login long-lived token refresh
        const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(access_token)}`;
        const res = await fetch(refreshUrl);
        const result = await res.json();
        if (!res.ok) throw new Error(formatGraphError(result, "renovar"));
        newAccessToken = result.access_token;
        if (result.expires_in) {
          expirationDate = new Date(Date.now() + result.expires_in * 1000).toISOString();
        }
      } else {
        // Facebook long-lived token refresh
        if (!app_id || !app_secret) {
          throw new Error("App ID e App Secret são necessários para renovar o token");
        }
        const refreshUrl = `${graphHost}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(app_id)}&client_secret=${encodeURIComponent(app_secret)}&fb_exchange_token=${encodeURIComponent(access_token)}`;
        const res = await fetch(refreshUrl);
        const result = await res.json();
        if (!res.ok) throw new Error(formatGraphError(result, "renovar"));
        newAccessToken = result.access_token;
        if (result.expires_in) {
          expirationDate = new Date(Date.now() + result.expires_in * 1000).toISOString();
        }
      }

      // Update the database with the new token and expiration date
      await supabase
        .from('instagram_settings')
        .update({ 
          access_token: newAccessToken,
          token_expires_at: expirationDate,
          updated_at: new Date().toISOString(),
          last_renewal_notification_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      const dateStr = expirationDate ? new Date(expirationDate).toLocaleDateString('pt-BR') : 'indeterminada';

      // Helper para gravar logs na aba Saúde
      const logEvent = async (
        event_type: string,
        status: string,
        message: string,
        metadata: Record<string, unknown> = {},
        channel = "system",
        target: string | null = null,
      ) => {
        try {
          await supabase.from("instagram_notification_logs").insert({
            user_id: user.id, event_type, status, channel, target, message, metadata,
          });
        } catch (e) {
          console.error("[token-manager] log fail:", e);
        }
      };

      await logEvent(
        "token_refresh",
        "success",
        `Renovação manual concluída — nova validade ${dateStr}`,
        { new_expires_at: expirationDate, trigger: "manual" },
      );

      // 1. Webhook Notification for n8n
      const webhookUrl = renewal_webhook_url;
      if (webhookUrl) {
        try {
          const whRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'instagram_token_renewed',
              user_id: user.id,
              new_token: newAccessToken,
              expires_at: expirationDate,
              timestamp: new Date().toISOString()
            })
          });
          await logEvent(
            "webhook_notify",
            whRes.ok ? "sent" : "failed",
            whRes.ok ? "Webhook n8n chamado com sucesso" : `Webhook falhou (HTTP ${whRes.status})`,
            { url: webhookUrl, status: whRes.status },
            "webhook",
            webhookUrl,
          );
        } catch (webhookErr: any) {
          console.error("Error calling renewal webhook:", webhookErr);
          await logEvent("webhook_notify", "failed", `Erro no webhook: ${webhookErr?.message || webhookErr}`, {}, "webhook", webhookUrl);
        }
      }

      // 2. WhatsApp Notification — usa mesma fonte do auto-refresh (billing_whatsapp_instances)
      let waSummary: any = { attempted: false };
      if (notify_whatsapp && Array.isArray(manager_numbers) && manager_numbers.length > 0) {
        const { data: instance, error: instErr } = await supabase
          .from("billing_whatsapp_instances")
          .select("api_url, api_key, instance_name")
          .eq("is_active", true)
          .order("last_used_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (instErr || !instance?.api_url || !instance?.api_key || !instance?.instance_name) {
          await logEvent(
            "whatsapp_alert",
            "failed",
            "Nenhuma instância Evolution ativa em billing_whatsapp_instances",
            { error: instErr?.message },
            "whatsapp",
          );
          waSummary = { attempted: true, sent: 0, failed: manager_numbers.length, reason: "no_active_instance" };
        } else {
          const message = `*🔄 Token Instagram Renovado (manual)*\n\nSeu Meta Access Token foi renovado com sucesso!\n\n📅 *Nova Validade:* ${dateStr}\n👤 *Usuário:* ${user.email}\n\nO novo token já está ativo no CRM${webhookUrl ? " e foi enviado para o n8n" : ""}.`;
          let sent = 0, failed = 0;
          for (const number of manager_numbers) {
            const cleanNumber = (number || "").replace(/\D/g, '');
            if (!cleanNumber) continue;
            try {
              const res = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': instance.api_key },
                body: JSON.stringify({ number: cleanNumber, text: message, delay: 1200 })
              });
              if (res.ok) {
                sent++;
                await logEvent("whatsapp_alert", "sent", `Notificação de renovação enviada para ${cleanNumber}`, { instance: instance.instance_name }, "whatsapp", cleanNumber);
              } else {
                failed++;
                const body = await res.text().catch(() => "");
                await logEvent("whatsapp_alert", "failed", `Falha WA [${res.status}] para ${cleanNumber}`, { body: body.slice(0, 300) }, "whatsapp", cleanNumber);
              }
            } catch (waErr: any) {
              failed++;
              console.error(`Error sending WA notification to ${number}:`, waErr);
              await logEvent("whatsapp_alert", "failed", `Erro WA para ${cleanNumber}: ${waErr?.message || waErr}`, {}, "whatsapp", cleanNumber);
            }
          }
          waSummary = { attempted: true, sent, failed, instance: instance.instance_name };
        }
      }

      return jsonResponse({ 
        success: true, 
        message: "Token renovado com sucesso! Nova validade: " + dateStr,
        data: {
          expires_at: expirationDate,
          whatsapp: waSummary,
          webhook_called: !!webhookUrl,
        } 
      });
    }


    throw new Error("Ação inválida");

  } catch (error: any) {
    console.error("Error managing Instagram token:", error);
    const message = error?.message || "Erro inesperado ao processar a operação";
    return jsonResponse({
      success: false,
      error: message,
      meta_error: isMetaTokenError(message),
      fallback: isMetaTokenError(message),
    });
  }
});
