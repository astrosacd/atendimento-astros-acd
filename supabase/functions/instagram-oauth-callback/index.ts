// Edge function: recebe o code OAuth do Facebook, troca por access_token, busca IG Business ID e salva no perfil
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v23.0";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function facebookErrorMessage(message: string, appId?: string) {
  if (message.toLowerCase().includes("validating client secret")) {
    return `Facebook App Secret inválido para o App ID ${appId || "configurado"}. Copie o App Secret do app principal no Facebook Developers → Configurações → Básico e salve novamente.`;
  }
  return message;
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
};

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
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const code: string = body.code;
    const state: string = body.state;
    const redirectUri: string = body.redirect_uri;
    if (!code || !state) throw new Error("code e state obrigatórios");

    const { data: cfg } = await admin.from("social_media_report_config").select("*").limit(1).maybeSingle();
    if (!cfg?.instagram_oauth_enabled) throw new Error("OAuth desabilitado");
    if (!cfg?.instagram_app_id || !cfg?.instagram_app_secret) throw new Error("App credentials não configuradas");

    const parsedState = JSON.parse(fromBase64Url(state));
    const payload = parsedState?.payload;
    const sig = parsedState?.sig;
    if (!payload || !sig) throw new Error("state inválido");
    const expectedSig = await signPayload(payload, cfg.instagram_app_secret);
    if (sig !== expectedSig) throw new Error("state inválido ou adulterado");
    if (Date.now() - Number(payload.iat || 0) > 15 * 60 * 1000) throw new Error("state expirado. Clique em reconectar novamente.");
    const profileId = payload.profileId;
    if (!profileId) throw new Error("state inválido");

    const isPublicInvite = !!payload.publicInvite;
    if (isPublicInvite) {
      // Revalida o invite — não pode ter sido usado nem expirado entre o /start e o /callback
      const { data: invite } = await admin
        .from("instagram_oauth_invites")
        .select("id, status, expires_at, profile_id")
        .eq("token", payload.inviteToken)
        .maybeSingle();
      if (!invite) throw new Error("Convite não encontrado.");
      if (new Date(invite.expires_at) < new Date()) throw new Error("Convite expirado.");
      if (invite.status === "completed") throw new Error("Este convite já foi usado.");
      if (invite.profile_id !== profileId) throw new Error("Convite não corresponde ao perfil.");
    } else {
      const { data: role } = await admin.from("user_roles").select("role").eq("user_id", payload.userId).eq("role", "admin").maybeSingle();
      if (!role) return jsonResponse({ error: "Forbidden" }, 403);
    }

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
      const message = facebookErrorMessage(tokenJson?.error?.message || String(tokenRes.status), cfg.instagram_app_id);
      throw new Error("Erro ao trocar code: " + message);
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

    // 3) Buscar o username do perfil-alvo no banco
    const { data: targetProfile } = await admin
      .from("social_media_client_profiles")
      .select("username")
      .eq("id", profileId)
      .maybeSingle();
    if (!targetProfile) throw new Error("Perfil não existe mais no sistema.");
    const targetUsername = String(targetProfile.username || "").replace(/^@/, "").toLowerCase().trim();

    // 4) Buscar páginas do usuário com IG vinculado (incluindo o PAGE access_token)
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${longToken}`
    );
    const pagesJson = await pagesRes.json();
    if (!pagesRes.ok || pagesJson.error) {
      throw new Error("Erro ao listar páginas: " + (pagesJson?.error?.message || `HTTP ${pagesRes.status}`));
    }
    const pages = (pagesJson.data || []).filter((p: any) => p.instagram_business_account);
    if (pages.length === 0) {
      throw new Error("Nenhuma conta Instagram Business vinculada às páginas do Facebook. Vincule no Business Manager primeiro.");
    }

    // 5) Encontrar a página cujo IG username bate com o perfil
    const matched = pages.find((p: any) =>
      String(p.instagram_business_account?.username || "").toLowerCase() === targetUsername
    );
    if (!matched) {
      const available = pages
        .map((p: any) => `@${p.instagram_business_account?.username || "?"}`)
        .join(", ");
      throw new Error(
        `A conta do Instagram autorizada não corresponde a @${targetUsername}. ` +
        `Você autorizou: ${available}. ` +
        `Volte ao Facebook e selecione a página vinculada a @${targetUsername}, ou cadastre o perfil com o username correto.`
      );
    }

    const igBusinessId = matched.instagram_business_account.id;
    const fbPageId = matched.id;
    // CRÍTICO: salvar o PAGE access token (não o user token).
    // Business Discovery + IG Insights exigem page token. Page tokens derivados
    // de long-lived user token não expiram, mas mantemos a janela de 60d.
    const pageAccessToken = matched.access_token || longToken;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 6) Salvar no perfil
    const { data: updatedProfile, error: upErr } = await admin
      .from("social_media_client_profiles")
      .update({
        oauth_connected: true,
        oauth_access_token: pageAccessToken,
        oauth_token_expires_at: expiresAt,
        oauth_ig_business_id: igBusinessId,
        oauth_fb_page_id: fbPageId,
        oauth_connected_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .select("id, username, oauth_connected, oauth_ig_business_id")
      .maybeSingle();

    if (upErr) throw upErr;
    if (!updatedProfile) {
      throw new Error("OAuth autorizado pelo Facebook, mas o perfil selecionado não existe mais no sistema. Volte para Instagram → Perfis Monitorados e clique em Reconectar no perfil correto.");
    }

    console.log("instagram-oauth-callback saved", {
      profileId: updatedProfile.id,
      username: updatedProfile.username,
      igBusinessId,
      fbPageId,
      publicInvite: isPublicInvite,
    });

    if (isPublicInvite && payload.inviteToken) {
      await admin
        .from("instagram_oauth_invites")
        .update({
          status: "completed",
          used_at: new Date().toISOString(),
          used_by_ig_username: updatedProfile.username,
        })
        .eq("token", payload.inviteToken);
    }

    return new Response(JSON.stringify({
      success: true,
      ig_business_id: igBusinessId,
      fb_page_id: fbPageId,
      expires_at: expiresAt,
      return_url: payload.returnUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("instagram-oauth-callback:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});
