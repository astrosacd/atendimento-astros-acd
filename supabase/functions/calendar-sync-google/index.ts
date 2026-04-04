import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Google Calendar config
    const { data: configs } = await supabase.from("calendar_config").select("*");
    const cfg: Record<string, string> = {};
    (configs || []).forEach((r: any) => { cfg[r.config_key] = r.config_value; });

    if (cfg.google_calendar_enabled !== "true") {
      return new Response(JSON.stringify({ message: "Google Calendar sync disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = cfg.google_client_id;
    const clientSecret = cfg.google_client_secret;
    const refreshToken = cfg.google_refresh_token;
    const calendarId = cfg.google_calendar_id || "primary";

    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(JSON.stringify({ error: "Google credentials not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // --- STEP 1: Push local events to Google ---
    const { data: localEvents } = await supabase
      .from("calendar_events")
      .select("*")
      .is("meet_link", null) // events not yet synced to Google
      .gte("start_time", new Date(Date.now() - 7 * 86400000).toISOString());

    let pushed = 0;
    for (const ev of (localEvents || [])) {
      // Check if already exists in Google by searching summary + time
      const existing = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${encodeURIComponent(ev.start_time)}&timeMax=${encodeURIComponent(ev.end_time)}&q=${encodeURIComponent(ev.title)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const existingData = await existing.json();
      if (existingData.items?.length > 0) continue;

      // Create in Google
      const body: any = {
        summary: ev.title,
        description: ev.description || ev.notes || "",
        start: { dateTime: ev.start_time, timeZone: "America/Sao_Paulo" },
        end: { dateTime: ev.end_time, timeZone: "America/Sao_Paulo" },
        location: ev.location || "",
      };
      if (ev.client_email) {
        body.attendees = [{ email: ev.client_email }];
      }

      const createRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (createRes.ok) {
        const created = await createRes.json();
        // Store Google event link or hangout link
        const meetLink = created.hangoutLink || created.htmlLink || null;
        if (meetLink) {
          await supabase.from("calendar_events").update({ meet_link: meetLink }).eq("id", ev.id);
        }
        pushed++;
      }
    }

    // --- STEP 2: Pull Google events to local ---
    const timeMin = new Date(Date.now() - 1 * 86400000).toISOString();
    const timeMax = new Date(Date.now() + 30 * 86400000).toISOString();

    const listRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      throw new Error(`Google Calendar API error: ${await listRes.text()}`);
    }

    const googleEvents = await listRes.json();
    let pulled = 0;

    for (const gEvent of (googleEvents.items || [])) {
      if (!gEvent.start?.dateTime || !gEvent.end?.dateTime) continue; // skip all-day events
      
      const summary = gEvent.summary || "Evento Google Calendar";
      const startTime = gEvent.start.dateTime;
      const endTime = gEvent.end.dateTime;

      // Check if already exists locally (by meet_link containing google event id or by exact time+title match)
      const { data: existingLocal } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("title", summary)
        .eq("start_time", startTime)
        .limit(1);

      if (existingLocal && existingLocal.length > 0) continue;

      // Also check by meet_link if it's a hangout link
      if (gEvent.hangoutLink) {
        const { data: byLink } = await supabase
          .from("calendar_events")
          .select("id")
          .eq("meet_link", gEvent.hangoutLink)
          .limit(1);
        if (byLink && byLink.length > 0) continue;
      }

      // Insert new local event from Google
      await supabase.from("calendar_events").insert({
        title: summary,
        description: gEvent.description || null,
        start_time: startTime,
        end_time: endTime,
        location: gEvent.location || null,
        meet_link: gEvent.hangoutLink || gEvent.htmlLink || null,
        client_email: gEvent.attendees?.[0]?.email || null,
        client_name: gEvent.attendees?.[0]?.displayName || null,
        status: gEvent.status === "cancelled" ? "cancelled" : "confirmed",
        notes: `[Importado do Google Calendar] ${gEvent.description || ""}`.trim(),
      });
      pulled++;
    }

    // --- STEP 3: Sync cancellations from Google ---
    const { data: localConfirmed } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, meet_link, status")
      .eq("status", "confirmed")
      .gte("start_time", timeMin)
      .lte("start_time", timeMax);

    let cancelled = 0;
    for (const ev of (localConfirmed || [])) {
      if (!ev.meet_link) continue;
      // Try to find in Google by time range
      const checkRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${encodeURIComponent(ev.start_time)}&timeMax=${encodeURIComponent(new Date(new Date(ev.start_time).getTime() + 60000).toISOString())}&q=${encodeURIComponent(ev.title)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const checkData = await checkRes.json();
      const match = (checkData.items || []).find((g: any) => g.status === "cancelled");
      if (match) {
        await supabase.from("calendar_events").update({ status: "cancelled" }).eq("id", ev.id);
        cancelled++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      pushed,
      pulled,
      cancelled,
      message: `Sincronização concluída: ${pushed} enviados, ${pulled} importados, ${cancelled} cancelados`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Calendar sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
