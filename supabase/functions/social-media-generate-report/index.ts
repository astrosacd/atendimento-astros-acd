import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function monthRange(month: string) {
  // month YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function computeMetrics(admin: any, profileId: string, month: string) {
  const { start, end } = monthRange(month);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Snapshots desse mês
  const { data: snaps } = await admin
    .from("social_media_daily_snapshots")
    .select("*")
    .eq("profile_id", profileId)
    .gte("snapshot_date", startISO.slice(0, 10))
    .lt("snapshot_date", endISO.slice(0, 10))
    .order("snapshot_date", { ascending: true });

  // Snapshot do último dia do mês anterior (pra comparar início vs fim)
  const { data: lastPrev } = await admin
    .from("social_media_daily_snapshots")
    .select("*")
    .eq("profile_id", profileId)
    .lt("snapshot_date", startISO.slice(0, 10))
    .order("snapshot_date", { ascending: false })
    .limit(1);

  const firstSnap = snaps?.[0] || lastPrev?.[0];
  const lastSnap = snaps?.[snaps.length - 1];

  const followersStart = firstSnap?.followers_count ?? null;
  const followersEnd = lastSnap?.followers_count ?? followersStart;
  const followersGain =
    followersStart != null && followersEnd != null ? followersEnd - followersStart : null;
  const followersPct =
    followersStart && followersGain != null ? (followersGain / followersStart) * 100 : null;

  // Mês anterior pra comparativo
  const prev = prevMonth(month);
  const { data: prevReport } = await admin
    .from("social_media_monthly_reports")
    .select("data")
    .eq("profile_id", profileId)
    .eq("month", prev)
    .maybeSingle();

  const prevFollowersGain = prevReport?.data?.followers?.gain ?? null;

  // Últimos relatórios anteriores (pra comparativo 3 meses)
  const { data: last3Reports } = await admin
    .from("social_media_monthly_reports")
    .select("month, data")
    .eq("profile_id", profileId)
    .lt("month", month)
    .order("month", { ascending: false })
    .limit(2);

  // Posts publicados no mês
  const { data: posts } = await admin
    .from("social_media_posts_collected")
    .select("*")
    .eq("profile_id", profileId)
    .gte("posted_at", startISO)
    .lt("posted_at", endISO)
    .order("posted_at", { ascending: false });

  const reels = (posts || []).filter((p: any) => p.media_product_type === "REELS" || p.media_type === "VIDEO").length;
  const carousels = (posts || []).filter((p: any) => p.media_type === "CAROUSEL_ALBUM").length;
  const images = (posts || []).filter((p: any) => p.media_type === "IMAGE").length;

  const totalLikes = (posts || []).reduce((a: number, p: any) => a + (p.like_count || 0), 0);
  const totalComments = (posts || []).reduce((a: number, p: any) => a + (p.comments_count || 0), 0);
  const totalEng = totalLikes + totalComments;
  const avgEng = posts?.length ? totalEng / posts.length : 0;

  // === Métricas OAuth (privadas) — só populadas se snapshots/posts vierem com source='oauth' ===
  const sumOauth = (key: string) =>
    (snaps || []).filter((s: any) => s.source === "oauth" && s[key] != null).reduce((a: number, s: any) => a + Number(s[key] || 0), 0);
  const hasOauthSnaps = (snaps || []).some((s: any) => s.source === "oauth");

  const reachMonth = hasOauthSnaps ? sumOauth("reach") : null;
  const impressionsMonth = hasOauthSnaps ? sumOauth("impressions") : null;
  const profileViewsMonth = hasOauthSnaps ? sumOauth("profile_views") : null;
  const websiteClicksMonth = hasOauthSnaps ? sumOauth("website_clicks") : null;
  const totalInteractionsMonth = hasOauthSnaps ? sumOauth("total_interactions") : null;
  const accountsEngagedAvg = hasOauthSnaps
    ? Math.round(((snaps || []).filter((s: any) => s.source === "oauth" && s.accounts_engaged != null).reduce((a: number, s: any) => a + Number(s.accounts_engaged), 0)) / Math.max(1, (snaps || []).filter((s: any) => s.source === "oauth" && s.accounts_engaged != null).length))
    : null;

  const postsOauth = (posts || []).filter((p: any) => p.insights_source === "oauth");
  const totalSaved = postsOauth.reduce((a: number, p: any) => a + (p.saved || 0), 0);
  const totalShares = postsOauth.reduce((a: number, p: any) => a + (p.shares || 0), 0);
  const totalReachPosts = postsOauth.reduce((a: number, p: any) => a + (p.reach || 0), 0);
  const totalPlays = postsOauth.reduce((a: number, p: any) => a + (p.plays || 0), 0);

  // Taxa real de engajamento (OAuth): interactions / reach por post
  const realEngRates = postsOauth
    .filter((p: any) => p.reach && p.reach > 0)
    .map((p: any) => (((p.like_count || 0) + (p.comments_count || 0) + (p.saved || 0) + (p.shares || 0)) / p.reach) * 100);
  const avgRealEngRate = realEngRates.length ? realEngRates.reduce((a: number, b: number) => a + b, 0) / realEngRates.length : null;

  // Demografia (vem do profile.audience_demographics)
  const { data: profileFull } = await admin
    .from("social_media_client_profiles")
    .select("audience_demographics, audience_demographics_updated_at, oauth_connected")
    .eq("id", profileId)
    .maybeSingle();

  // Top post — agora considera engajamento estendido se OAuth
  const topPost = (posts || [])
    .map((p: any) => ({
      ...p,
      eng: (p.like_count || 0) + (p.comments_count || 0) + (p.saved || 0) + (p.shares || 0),
    }))
    .sort((a: any, b: any) => b.eng - a.eng)[0] || null;

  // Histórico (últimos 6 meses de snapshots) p/ gráfico
  const sixMonthsAgo = new Date(start);
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5);
  const { data: history } = await admin
    .from("social_media_daily_snapshots")
    .select("snapshot_date, followers_count, reach, impressions, source")
    .eq("profile_id", profileId)
    .gte("snapshot_date", sixMonthsAgo.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: true });

  // Comparativo 3 meses (cronológico: mais antigo → atual)
  const last3Months = [
    ...(last3Reports || []).map((r: any) => ({
      month: r.month,
      followers_gain: r.data?.followers?.gain ?? 0,
      posts_total: r.data?.posts?.total ?? 0,
      engagement_total: r.data?.engagement?.total ?? 0,
      reach: r.data?.oauth?.reach ?? 0,
    })),
    {
      month,
      followers_gain: followersGain ?? 0,
      posts_total: posts?.length || 0,
      engagement_total: totalEng,
      reach: reachMonth ?? 0,
    },
  ].reverse().slice(0, 3).reverse();

  return {
    month,
    period: { start: startISO, end: endISO },
    source: hasOauthSnaps ? "oauth" : "business_discovery",
    followers: {
      start: followersStart,
      end: followersEnd,
      gain: followersGain,
      pct_growth: followersPct,
      vs_prev_month_gain: prevFollowersGain,
    },
    posts: {
      total: posts?.length || 0,
      reels,
      carousels,
      images,
    },
    engagement: {
      total_likes: totalLikes,
      total_comments: totalComments,
      total: totalEng,
      avg_per_post: avgEng,
    },
    oauth: hasOauthSnaps ? {
      reach: reachMonth,
      impressions: impressionsMonth,
      profile_views: profileViewsMonth,
      website_clicks: websiteClicksMonth,
      total_interactions: totalInteractionsMonth,
      accounts_engaged_avg: accountsEngagedAvg,
      total_saved: totalSaved,
      total_shares: totalShares,
      total_reach_posts: totalReachPosts,
      total_plays: totalPlays,
      avg_real_eng_rate: avgRealEngRate,
      demographics: profileFull?.audience_demographics || null,
      demographics_updated_at: profileFull?.audience_demographics_updated_at || null,
    } : null,
    top_post: topPost
      ? {
          id: topPost.ig_media_id,
          permalink: topPost.permalink,
          thumbnail_url: topPost.thumbnail_url || topPost.media_url,
          caption: (topPost.caption || "").slice(0, 200),
          likes: topPost.like_count,
          comments: topPost.comments_count,
          saved: topPost.saved,
          shares: topPost.shares,
          reach: topPost.reach,
          posted_at: topPost.posted_at,
        }
      : null,
    daily_history: (history || []).map((h: any) => ({
      date: h.snapshot_date,
      followers: h.followers_count,
      reach: h.reach,
      impressions: h.impressions,
    })),
    last_3_months: last3Months,
  };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    const isCron = req.headers.get("x-cron-call") === "1";
    let userId: string | null = null;

    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (!claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claims.claims.sub;
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!role) {
        return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const profileId: string = body.profile_id;
    const month: string = body.month; // YYYY-MM

    if (!profileId || !month) {
      return new Response(JSON.stringify({ error: "profile_id e month são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metrics = await computeMetrics(admin, profileId, month);

    const { data: saved, error } = await admin
      .from("social_media_monthly_reports")
      .upsert(
        {
          profile_id: profileId,
          month,
          data: metrics,
          generated_by: userId,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,month" },
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ report: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("social-media-generate-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
