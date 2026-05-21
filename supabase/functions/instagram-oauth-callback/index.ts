// Edge function: recebe o code OAuth do Facebook, troca por access_token, busca IG Business ID e salva no perfil
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v23.0";

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
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", claims.claims.sub).eq("role", "admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const body = await req.json();
    const code: string = body.code;
    const state: string = body.state;
    const redirectUri: string = body.redirect_uri;
    if (!code || !state) throw new Error("code e state obrigatórios");

    const parsed = JSON.parse(atob(state));
    const profileId = parsed.profileId;
    if (!profileId) throw new Error("state inválido");

    const { data: cfg } = await admin.from("social_media_report_config").select("*").limit(1).maybeSingle();
    if (!cfg?.instagram_oauth_enabled) throw new Error("OAuth desabilitado");
    if (!cfg?.instagram_app_id || !cfg?.instagram_app_secret) throw new Error("App credentials não configuradas");

    // 1) Trocar code por short-lived access_token
    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
      `client_id=${cfg.instagram_app_id}` +
      `&client_secret=${cfg.instagram_app_secret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${code}`,
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error) {
      throw new Error("Erro ao trocar code: " + (tokenJson?.error?.message || tokenRes.status));
    }
    const shortToken = tokenJson.access_token;

    // 2) Trocar por long-lived token (60 dias)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${cfg.instagram_app_id}` +
      `&client_secret=${cfg.instagram_app_secret}` +
      `&fb_exchange_token=${shortToken}`,
    );
    const longJson = await longRes.json();
    const longToken = longJson.access_token || shortToken;
    const expiresIn = longJson.expires_in || 60 * 24 * 3600; // 60 dias default

    // 3) Buscar páginas do usuário e o IG Business ID associado
    const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name,instagram_business_account&access_token=${longToken}`);
    const pagesJson = await pagesRes.json();
    const pages = pagesJson.data || [];
    const pageWithIG = pages.find((p: any) => p.instagram_business_account);
    if (!pageWithIG) {
      throw new Error("Nenhuma conta Instagram Business vinculada às páginas do Facebook. Vincule no Business Manager primeiro.");
    }

    const igBusinessId = pageWithIG.instagram_business_account.id;
    const fbPageId = pageWithIG.id;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 4) Salvar no perfil
    const { error: upErr } = await admin
      .from("social_media_client_profiles")
      .update({
        oauth_connected: true,
        oauth_access_token: longToken,
        oauth_token_expires_at: expiresAt,
        oauth_ig_business_id: igBusinessId,
        oauth_fb_page_id: fbPageId,
        oauth_connected_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (upErr) throw upErr;

    return new Response(JSON.stringify({
      success: true,
      ig_business_id: igBusinessId,
      fb_page_id: fbPageId,
      expires_at: expiresAt,
      return_url: parsed.returnUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("instagram-oauth-callback:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
