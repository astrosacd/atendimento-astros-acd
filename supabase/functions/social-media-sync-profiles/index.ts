import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v23.0";

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const m = text.match(/#[\p{L}0-9_]+/gu) || [];
  return Array.from(new Set(m.map((h) => h.toLowerCase())));
}

async function fetchBD(igUserId: string, token: string, username: string) {
  const fields =
    `business_discovery.username(${username}){` +
    `id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,` +
    `media.limit(50){id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count}` +
    `}`;
  const url = `${GRAPH}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`);
  }
  return json.business_discovery;
}


// ============ OAuth (insights privados) ============
async function fetchOAuthAccount(igBusinessId: string, token: string) {
  const fields = "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url";
  const url = `${GRAPH}/${igBusinessId}?fields=${fields}&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json;
}

async function fetchAccountInsights(igBusinessId: string, token: string) {
  // metric API v23: usa metric_type=total_value para alguns; mantemos formato simples por dia
  const metrics = "reach,impressions,profile_views,website_clicks,accounts_engaged,total_interactions";
  const since = Math.floor(Date.now() / 1000) - 2 * 86400;
  const until = Math.floor(Date.now() / 1000);
  const url = `${GRAPH}/${igBusinessId}/insights?metric=${metrics}&period=day&since=${since}&until=${until}&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    console.warn("insights account error:", json?.error?.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const m of json.data || []) {
    const last = m.values?.[m.values.length - 1];
    if (last?.value != null) out[m.name] = Number(last.value) || 0;
  }
  return out;
}

async function fetchAudienceDemographics(igBusinessId: string, token: string) {
  const out: any = {};
  const breakdowns = ["age", "gender", "country", "city"];
  for (const bd of breakdowns) {
    try {
      const url = `${GRAPH}/${igBusinessId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${bd}&access_token=${token}`;
      const res = await fetch(url);
      const j = await res.json();
      if (res.ok && !j.error) {
        const vals = j.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
        out[bd] = vals.map((r: any) => ({ key: r.dimension_values?.[0], value: r.value }));
      }
    } catch (_) { /* ignora */ }
  }
  return out;
}

async function fetchOAuthMedia(igBusinessId: string, token: string) {
  const fields = "id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count";
  const url = `${GRAPH}/${igBusinessId}/media?fields=${fields}&limit=50&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json.data || [];
}

async function fetchMediaInsights(mediaId: string, mediaType: string, productType: string | null, token: string) {
  // metrics dependem do tipo
  let metrics = "reach,impressions,saved,total_interactions,shares";
  if (productType === "REELS" || mediaType === "VIDEO") metrics += ",plays";
  const url = `${GRAPH}/${mediaId}/insights?metric=${metrics}&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) return {};
  const out: Record<string, number> = {};
  for (const m of json.data || []) {
    out[m.name] = Number(m.values?.[0]?.value) || 0;
  }
  return out;
}

// ============ Sync principal ============
async function syncOne(admin: any, profile: any, fallbackIgUserId: string, fallbackToken: string) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const useOAuth = profile.oauth_connected
      && profile.oauth_access_token
      && profile.oauth_ig_business_id
      && (!profile.oauth_token_expires_at || new Date(profile.oauth_token_expires_at) > new Date());

    if (useOAuth) {
      // ===== Fluxo OAuth (dados privados) =====
      const token = profile.oauth_access_token;
      const igId = profile.oauth_ig_business_id;
      const acc = await fetchOAuthAccount(igId, token);
      const insights = await fetchAccountInsights(igId, token);

      await admin.from("social_media_client_profiles").update({
        ig_business_id: acc.id,
        display_name: acc.name || profile.display_name,
        profile_picture_url: acc.profile_picture_url,
        followers_count: acc.followers_count ?? null,
        last_synced_at: new Date().toISOString(),
        last_sync_status: "ok",
        last_sync_error: null,
      }).eq("id", profile.id);

      // demografia 1x por semana
      const demoStale = !profile.audience_demographics_updated_at
        || (Date.now() - new Date(profile.audience_demographics_updated_at).getTime()) > 7 * 86400 * 1000;
      if (demoStale) {
        const demo = await fetchAudienceDemographics(igId, token);
        if (Object.keys(demo).length) {
          await admin.from("social_media_client_profiles").update({
            audience_demographics: demo,
            audience_demographics_updated_at: new Date().toISOString(),
          }).eq("id", profile.id);
        }
      }

      await admin.from("social_media_daily_snapshots").upsert({
        profile_id: profile.id,
        snapshot_date: today,
        followers_count: acc.followers_count ?? null,
        media_count: acc.media_count ?? null,
        following_count: acc.follows_count ?? null,
        reach: insights.reach ?? null,
        impressions: insights.impressions ?? null,
        profile_views: insights.profile_views ?? null,
        website_clicks: insights.website_clicks ?? null,
        accounts_engaged: insights.accounts_engaged ?? null,
        total_interactions: insights.total_interactions ?? null,
        source: "oauth",
      }, { onConflict: "profile_id,snapshot_date" });

      const mediaList = await fetchOAuthMedia(igId, token);
      let postsSynced = 0;
      for (const m of mediaList) {
        const mi = await fetchMediaInsights(m.id, m.media_type, m.media_product_type, token);
        const { error: e } = await admin.from("social_media_posts_collected").upsert({
          profile_id: profile.id,
          ig_media_id: m.id,
          media_type: m.media_type || "UNKNOWN",
          media_product_type: m.media_product_type || null,
          caption: m.caption || null,
          permalink: m.permalink || null,
          media_url: m.media_url || null,
          thumbnail_url: m.thumbnail_url || null,
          like_count: m.like_count ?? 0,
          comments_count: m.comments_count ?? 0,
          views_count: mi.plays ?? null,
          reach: mi.reach ?? null,
          impressions: mi.impressions ?? null,
          saved: mi.saved ?? null,
          total_interactions: mi.total_interactions ?? null,
          plays: mi.plays ?? null,
          shares: mi.shares ?? null,
          insights_source: "oauth",
          hashtags: extractHashtags(m.caption),
          posted_at: m.timestamp || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "profile_id,ig_media_id" });
        if (!e) postsSynced++;
        await new Promise(r => setTimeout(r, 150));
      }

      return { profile_id: profile.id, username: profile.username, status: "ok", source: "oauth", posts_synced: postsSynced, followers: acc.followers_count };
    }

    // ===== Fluxo business_discovery (dados públicos) =====
    const bd = await fetchBD(fallbackIgUserId, fallbackToken, profile.username);

    await admin.from("social_media_client_profiles").update({
      ig_business_id: bd.id,
      display_name: bd.name || profile.display_name,
      profile_picture_url: bd.profile_picture_url,
      followers_count: bd.followers_count ?? null,
      last_synced_at: new Date().toISOString(),
      last_sync_status: "ok",
      last_sync_error: null,
    }).eq("id", profile.id);

    await admin.from("social_media_daily_snapshots").upsert({
      profile_id: profile.id,
      snapshot_date: today,
      followers_count: bd.followers_count ?? null,
      media_count: bd.media_count ?? null,
      following_count: bd.follows_count ?? null,
      source: "business_discovery",
    }, { onConflict: "profile_id,snapshot_date" });

    const mediaList = bd.media?.data || [];
    let postsSynced = 0;
    for (const m of mediaList) {
      const { error: e } = await admin.from("social_media_posts_collected").upsert({
        profile_id: profile.id,
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
        hashtags: extractHashtags(m.caption),
        posted_at: m.timestamp || null,
        synced_at: new Date().toISOString(),
        insights_source: "business_discovery",
      }, { onConflict: "profile_id,ig_media_id" });
      if (!e) postsSynced++;
    }

    return { profile_id: profile.id, username: profile.username, status: "ok", source: "business_discovery", posts_synced: postsSynced, followers: bd.followers_count };
  } catch (e: any) {
    await admin.from("social_media_client_profiles").update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "error",
      last_sync_error: e.message?.slice(0, 500) || "Erro desconhecido",
    }).eq("id", profile.id);
    return { profile_id: profile.id, username: profile.username, status: "error", error: e.message };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth — só admin pode disparar manual; cron usa service role (sem JWT user)
    const authHeader = req.headers.get("Authorization");
    const isCron = req.headers.get("x-cron-call") === "1";
    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const tokenJWT = authHeader.replace("Bearer ", "");
      const { data: claims } = await userClient.auth.getClaims(tokenJWT);
      if (!claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", claims.claims.sub).eq("role", "admin").maybeSingle();
      if (!role) {
        return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const profileId: string | undefined = body.profile_id;
    const syncAll = !!body.sync_all;

    const { data: settings } = await admin
      .from("instagram_settings")
      .select("access_token, ig_user_id")
      .limit(1)
      .maybeSingle();

    const igUserId = settings?.ig_user_id;
    const accessToken = settings?.access_token || Deno.env.get("META_ACCESS_TOKEN");

    let query = admin.from("social_media_client_profiles").select("*").eq("is_active", true);
    if (profileId && !syncAll) query = query.eq("id", profileId);

    const { data: profiles, error: pErr } = await query;
    if (pErr) throw pErr;
    if (!profiles?.length) {
      return new Response(JSON.stringify({ results: [], message: "Nenhum perfil para sincronizar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se algum perfil precisar do fallback business_discovery e não tiver token, retorna erro só pra esses
    const needsFallback = profiles.some((p: any) => !p.oauth_connected || !p.oauth_access_token);
    if (needsFallback && (!igUserId || !accessToken)) {
      return new Response(JSON.stringify({
        error: "Há perfis sem OAuth conectado. Configure ig_user_id e access_token em Configurações do Instagram, ou conecte os perfis via OAuth.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];
    for (const p of profiles) {
      const r = await syncOne(admin, p, igUserId, accessToken);
      results.push(r);
      await new Promise((res) => setTimeout(res, 300));
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("social-media-sync-profiles error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
