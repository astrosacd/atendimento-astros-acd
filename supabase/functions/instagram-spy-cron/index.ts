import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v23.0";

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/#[\p{L}0-9_]+/gu) || [];
  return Array.from(new Set(matches.map((h) => h.toLowerCase())));
}

async function fetchBusinessDiscovery(igUserId: string, accessToken: string, username: string) {
  const fields =
    `business_discovery.username(${username}){id,username,name,followers_count,profile_picture_url,` +
    `media.limit(25){id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count}}`;
  const url = `${GRAPH}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${accessToken}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json.business_discovery;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Endpoint público acionado pelo pg_cron (sem JWT de usuário).
  // Protegido pelo fato de só rodar via cron interno + nada destrutivo exposto.
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: config } = await admin
      .from("instagram_espionage_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config?.auto_sync_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "auto_sync_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await admin
      .from("instagram_settings")
      .select("access_token, ig_user_id")
      .limit(1)
      .maybeSingle();

    const igUserId = settings?.ig_user_id;
    const accessToken = settings?.access_token || Deno.env.get("META_ACCESS_TOKEN");

    if (!igUserId || !accessToken) {
      await admin.from("instagram_espionage_config").update({
        last_auto_run_at: new Date().toISOString(),
        last_auto_run_status: "error: instagram_settings ausente",
      }).eq("id", config.id);
      return new Response(JSON.stringify({ error: "instagram_settings ausente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: competitors } = await admin
      .from("instagram_competitors").select("*").eq("is_active", true);

    let ok = 0, err = 0;
    for (const c of competitors || []) {
      try {
        const bd = await fetchBusinessDiscovery(igUserId, accessToken, c.username);
        await admin.from("instagram_competitors").update({
          ig_business_id: bd.id,
          display_name: bd.name || c.display_name,
          profile_picture_url: bd.profile_picture_url,
          followers_count: bd.followers_count ?? null,
          last_synced_at: new Date().toISOString(),
          last_sync_status: "ok",
          last_sync_error: null,
        }).eq("id", c.id);

        for (const m of bd.media?.data || []) {
          await admin.from("instagram_competitor_posts").upsert({
            competitor_id: c.id,
            ig_media_id: m.id,
            media_type: m.media_type || "UNKNOWN",
            media_product_type: m.media_product_type || null,
            caption: m.caption || null,
            permalink: m.permalink || null,
            media_url: m.media_url || null,
            thumbnail_url: m.thumbnail_url || null,
            like_count: m.like_count ?? 0,
            comments_count: m.comments_count ?? 0,
            hashtags: extractHashtags(m.caption),
            posted_at: m.timestamp || null,
            synced_at: new Date().toISOString(),
          }, { onConflict: "competitor_id,ig_media_id" });
        }
        ok++;
      } catch (e: any) {
        err++;
        await admin.from("instagram_competitors").update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: e.message?.slice(0, 500),
        }).eq("id", c.id);
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    await admin.from("instagram_espionage_config").update({
      last_auto_run_at: new Date().toISOString(),
      last_auto_run_status: `sync: ${ok} ok, ${err} erros`,
    }).eq("id", config.id);

    // Análise automática global (sem competitor_id) se ligada
    if (config.auto_analysis_enabled && ok > 0) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/instagram-spy-analyze-internal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "x-internal-cron": "true",
          },
          body: JSON.stringify({
            analysis_type: config.default_analysis_type,
            period_days: config.default_analysis_period_days,
          }),
        });
      } catch (e) {
        console.error("Auto analysis failed:", e);
      }
    }

    return new Response(JSON.stringify({ ok, err }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("instagram-spy-cron error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
