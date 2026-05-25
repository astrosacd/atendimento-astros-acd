// Edge function: gera URL de autorização OAuth do Facebook para conectar a conta IG Business do cliente
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const encodeState = (value: unknown) =>
  toBase64Url(new TextEncoder().encode(JSON.stringify(value)));

async function assertFacebookAppCredentials(appId: string, appSecret: string) {
  const res = await fetch(
    `https://graph.facebook.com/v23.0/oauth/access_token?` +
    `client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&grant_type=client_credentials`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const message = json?.error?.message || `Facebook retornou HTTP ${res.status}`;
    if (message.toLowerCase().includes("validating client secret")) {
      throw new Error(`Facebook App Secret inválido para o App ID ${appId}. Copie o App Secret do app principal no Facebook Developers → Configurações → Básico e salve novamente.`);
    }
    throw new Error(`Credenciais do Facebook inválidas: ${message}`);
  }
}

async function signPayload(payload: Record<string, unknown>, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(payload)));
  return toBase64Url(new Uint8Array(signature));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const userId = claims.claims.sub;
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const body = await req.json();
    const profileId: string = body.profile_id;
    const returnUrl: string = body.return_url || "";
    if (!profileId) throw new Error("profile_id obrigatório");

    const { data: cfg } = await admin.from("social_media_report_config").select("*").limit(1).maybeSingle();
    if (!cfg?.instagram_oauth_enabled) throw new Error("OAuth Instagram desabilitado nas Configurações");
    if (!cfg?.instagram_app_id) throw new Error("Facebook App ID não configurado");
    if (!cfg?.instagram_app_secret) throw new Error("Facebook App Secret não configurado");
    await assertFacebookAppCredentials(String(cfg.instagram_app_id).trim(), String(cfg.instagram_app_secret).trim());

    // state assinado: permite a callback em nova aba sem depender da sessão localStorage da aplicação.
    const nonce = crypto.randomUUID();
    const payload = { profileId, userId, returnUrl, nonce, iat: Date.now() };
    const state = encodeState({ payload, sig: await signPayload(payload, cfg.instagram_app_secret) });

    // Resolver site URL: prioridade = body.site_url > gateway_settings.site_base_url > returnUrl origin
    let baseUrl: string | null = (body.site_url || "").toString().trim().replace(/\/+$/, "") || null;
    if (!baseUrl) {
      const { data: gw } = await admin
        .from("gateway_settings")
        .select("value")
        .eq("key", "site_base_url")
        .maybeSingle();
      const u = String((gw?.value as any)?.url || "").trim().replace(/\/+$/, "");
      if (u) baseUrl = u;
    }
    if (!baseUrl && returnUrl) {
      try { baseUrl = new URL(returnUrl).origin; } catch { /* ignore */ }
    }
    if (!baseUrl) throw new Error("URL pública do site não configurada. Defina em Gateway → Configurações (site_base_url).");
    if (baseUrl.includes("id-preview--")) {
      throw new Error("Redirect URI aponta para a preview do editor (id-preview-*). Configure a URL pública publicada em Gateway → Configurações.");
    }
    const redirectUri = `${baseUrl}/instagram/oauth-callback`;

    const scopes = [
      "instagram_basic",
      "instagram_manage_insights",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ].join(",");

    const authUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${cfg.instagram_app_id}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code`;

    return jsonResponse({ auth_url: authUrl, redirect_uri: redirectUri });
  } catch (e: any) {
    console.error("instagram-oauth-start:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
