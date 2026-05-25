import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v23.0";

interface SyncResult {
  competitor_id: string;
  username: string;
  status: "ok" | "error";
  posts_synced?: number;
  error?: string;
}

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/#[\p{L}0-9_]+/gu) || [];
  return Array.from(new Set(matches.map((h) => h.toLowerCase())));
}

async function fetchBusinessDiscovery(igUserId: string, accessToken: string, username: string) {
  const fields =
    `business_discovery.username(${username}){` +
    `id,username,name,biography,followers_count,media_count,profile_picture_url,` +
    `media.limit(25){id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count}` +
    `}`;
  const url = `${GRAPH}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.business_discovery;
}

async function syncOne(
  admin: any,
  competitor: any,
  igUserId: string,
  accessToken: string,
): Promise<SyncResult> {
  try {
    const bd = await fetchBusinessDiscovery(igUserId, accessToken, competitor.username);

    // Atualiza dados do perfil
    await admin
      .from("instagram_competitors")
      .update({
        ig_business_id: bd.id,
        display_name: bd.name || competitor.display_name,
        profile_picture_url: bd.profile_picture_url,
        followers_count: bd.followers_count ?? null,
        last_synced_at: new Date().toISOString(),
        last_sync_status: "ok",
        last_sync_error: null,
      })
      .eq("id", competitor.id);

    const mediaList = bd.media?.data || [];
    let synced = 0;

    for (const m of mediaList) {
      const hashtags = extractHashtags(m.caption);
      const { error: upsertErr } = await admin
        .from("instagram_competitor_posts")
        .upsert(
          {
            competitor_id: competitor.id,
            ig_media_id: m.id,
            media_type: m.media_type || "UNKNOWN",
            media_product_type: m.media_product_type || null,
            caption: m.caption || null,
            permalink: m.permalink || null,
            media_url: m.media_url || null,
            thumbnail_url: m.thumbnail_url || null,
            like_count: m.like_count ?? 0,
            comments_count: m.comments_count ?? 0,
            views_count: null,
            hashtags,
            posted_at: m.timestamp || null,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "competitor_id,ig_media_id" },
        );
      if (!upsertErr) synced++;
    }

    return { competitor_id: competitor.id, username: competitor.username, status: "ok", posts_synced: synced };
  } catch (e: any) {
    await admin
      .from("instagram_competitors")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: e.message?.slice(0, 500) || "Erro desconhecido",
      })
      .eq("id", competitor.id);
    return { competitor_id: competitor.id, username: competitor.username, status: "error", error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: isAdminData } = await admin.rpc("is_admin");
    // is_admin() RPC uses auth.uid() — we need to check via direct query
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const competitorId: string | undefined = body.competitor_id;
    const syncAll: boolean = !!body.sync_all;

    // Busca token: 1º perfil OAuth conectado com token válido; depois fallback pra instagram_settings.
    let igUserId: string | null = null;
    let accessToken: string | null = null;
    let tokenSource = "none";

    const { data: oauthProfile } = await admin
      .from("social_media_client_profiles")
      .select("oauth_ig_business_id, oauth_access_token, oauth_token_expires_at, username")
      .eq("oauth_connected", true)
      .not("oauth_access_token", "is", null)
      .not("oauth_ig_business_id", "is", null)
      .gt("oauth_token_expires_at", new Date().toISOString())
      .order("oauth_connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (oauthProfile?.oauth_access_token && oauthProfile?.oauth_ig_business_id) {
      igUserId = oauthProfile.oauth_ig_business_id;
      accessToken = oauthProfile.oauth_access_token;
      tokenSource = `oauth:@${oauthProfile.username}`;
    } else {
      const { data: settings } = await admin
        .from("instagram_settings")
        .select("access_token, ig_user_id")
        .limit(1)
        .maybeSingle();
      if (settings?.ig_user_id && settings?.access_token) {
        igUserId = settings.ig_user_id;
        accessToken = settings.access_token;
        tokenSource = "instagram_settings (legado)";
      } else if (Deno.env.get("META_ACCESS_TOKEN") && settings?.ig_user_id) {
        igUserId = settings.ig_user_id;
        accessToken = Deno.env.get("META_ACCESS_TOKEN")!;
        tokenSource = "env";
      }
    }

    if (!igUserId || !accessToken) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhum token Instagram disponível. Conecte ao menos 1 perfil via OAuth em Instagram → Perfis Monitorados → Reconectar (ou peça ao cliente via Link de Autorização).",
          requires_oauth: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("instagram-spy-sync token source:", tokenSource);

    // Buscar competidores
    let query = admin.from("instagram_competitors").select("*").eq("is_active", true);
    if (competitorId && !syncAll) query = query.eq("id", competitorId);

    const { data: competitors, error: cErr } = await query;
    if (cErr) throw cErr;
    if (!competitors || competitors.length === 0) {
      return new Response(JSON.stringify({ results: [], message: "Nenhum concorrente para sincronizar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: SyncResult[] = [];
    for (const c of competitors) {
      const r = await syncOne(admin, c, igUserId, accessToken);
      results.push(r);
      // pequeno delay para nao estourar rate limit
      await new Promise((res) => setTimeout(res, 300));
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("instagram-spy-sync error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
