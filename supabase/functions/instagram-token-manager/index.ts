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

      // 1. Webhook Notification for n8n
      const webhookUrl = renewal_webhook_url;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
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
        } catch (webhookErr) {
          console.error("Error calling renewal webhook:", webhookErr);
        }
      }

      // 2. WhatsApp Notification
      if (notify_whatsapp && manager_numbers && Array.isArray(manager_numbers) && manager_numbers.length > 0) {
        const { data: evolutionConfig } = await supabase
          .from('billing_config')
          .select('config_key, config_value')
          .like('config_key', 'evolution_%');

        const configMap: Record<string, string> = {};
        evolutionConfig?.forEach(c => configMap[c.config_key] = c.config_value);

        const apiUrl = configMap['evolution_api_url'];
        const apiKey = configMap['evolution_api_key'];
        const instanceName = configMap['evolution_instance_name'];

        if (apiUrl && apiKey && instanceName) {
          const dateStr = expirationDate ? new Date(expirationDate).toLocaleDateString('pt-BR') : 'indeterminada';
          const message = `*🔄 Token Instagram Renovado*\n\nSeu Meta Access Token foi renovado com sucesso!\n\n📅 *Nova Validade:* ${dateStr}\n👤 *Usuário:* ${user.email}\n\nO novo token já está ativo no CRM e foi enviado para o n8n.`;

          for (const number of manager_numbers) {
            const cleanNumber = number.replace(/\D/g, '');
            if (!cleanNumber) continue;

            try {
              await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': apiKey
                },
                body: JSON.stringify({
                  number: cleanNumber,
                  text: message,
                  delay: 1200
                })
              });
            } catch (waErr) {
              console.error(`Error sending WA notification to ${number}:`, waErr);
            }
          }
        }
      }

      return jsonResponse({ 
        success: true, 
        message: "Token renovado com sucesso! Nova validade: " + (expirationDate ? new Date(expirationDate).toLocaleDateString('pt-BR') : 'indeterminada'),
        data: {
          expires_at: expirationDate
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
