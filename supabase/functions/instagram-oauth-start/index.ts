// Edge function: gera URL de autorização OAuth do Facebook para conectar a conta IG Business do cliente
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // state = base64(profileId|userId|returnUrl|nonce)
    const nonce = crypto.randomUUID();
    const state = btoa(JSON.stringify({ profileId, userId, returnUrl, nonce }));

    // O frontend redireciona para /instagram/oauth-callback que chama a edge function instagram-oauth-callback
    const origin = new URL(returnUrl || "https://atendimento-astros-acd.lovable.app").origin;
    const redirectUri = `${origin}/instagram/oauth-callback`;

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

    return new Response(JSON.stringify({ auth_url: authUrl, redirect_uri: redirectUri }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("instagram-oauth-start:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
