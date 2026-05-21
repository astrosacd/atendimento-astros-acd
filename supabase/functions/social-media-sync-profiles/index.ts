import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function syncOne(admin: any, profile: any, igUserId: string, token: string) {
  try {
    const bd = await fetchBD(igUserId, token, profile.username);

    // 1) Update profile
    await admin
      .from("social_media_client_profiles")
      .update({
        ig_business_id: bd.id,
        display_name: bd.name || profile.display_name,
        profile_picture_url: bd.profile_picture_url,
        followers_count: bd.followers_count ?? null,
        last_synced_at: new Date().toISOString(),
        last_sync_status: "ok",
        last_sync_error: null,
      })
      .eq("id", profile.id);

    // 2) Daily snapshot (upsert by profile_id + date)
    const today = new Date().toISOString().slice(0, 10);
    await admin
      .from("social_media_daily_snapshots")
      .upsert(
        {
          profile_id: profile.id,
          snapshot_date: today,
          followers_count: bd.followers_count ?? null,
          media_count: bd.media_count ?? null,
          following_count: bd.follows_count ?? null,
        },
        { onConflict: "profile_id,snapshot_date" },
      );

    // 3) Posts
    const mediaList = bd.media?.data || [];
    let postsSynced = 0;
    for (const m of mediaList) {
      const { error: e } = await admin
        .from("social_media_posts_collected")
        .upsert(
          {
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
          },
          { onConflict: "profile_id,ig_media_id" },
        );
      if (!e) postsSynced++;
    }

    return { profile_id: profile.id, username: profile.username, status: "ok", posts_synced: postsSynced, followers: bd.followers_count };
  } catch (e: any) {
    await admin
      .from("social_media_client_profiles")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: e.message?.slice(0, 500) || "Erro desconhecido",
      })
      .eq("id", profile.id);
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

    if (!igUserId || !accessToken) {
      return new Response(JSON.stringify({
        error: "Instagram não configurado. Configure ig_user_id e access_token em Configurações do Instagram.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let query = admin.from("social_media_client_profiles").select("*").eq("is_active", true);
    if (profileId && !syncAll) query = query.eq("id", profileId);

    const { data: profiles, error: pErr } = await query;
    if (pErr) throw pErr;
    if (!profiles?.length) {
      return new Response(JSON.stringify({ results: [], message: "Nenhum perfil para sincronizar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
