import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
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

    // Check if this is a specific action request (update/cancel/delete a single event)
    let actionRequest: { action?: string; eventId?: string } = {};
    try {
      const body = await req.json();
      actionRequest = body || {};
    } catch {
      // No body or invalid JSON - do full sync
    }

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

    // --- Handle specific actions ---
    if (actionRequest.action && actionRequest.eventId) {
      const { action, eventId } = actionRequest;
      
      const { data: localEvent } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (!localEvent) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const googleEventId = localEvent.google_event_id;

      if (action === "update" && googleEventId) {
        // Update event in Google Calendar
        const body: any = {
          summary: localEvent.title,
          description: [localEvent.description, localEvent.notes].filter(Boolean).join("\n\n---\nObservações:\n") || "",
          start: { dateTime: localEvent.start_time, timeZone: "America/Sao_Paulo" },
          end: { dateTime: localEvent.end_time, timeZone: "America/Sao_Paulo" },
          location: localEvent.location || "",
        };
        if (localEvent.client_email) {
          body.attendees = [{ email: localEvent.client_email }];
        }

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) {
          const err = await res.text();
          console.error("Google update error:", err);
          return new Response(JSON.stringify({ error: `Google update failed: ${err}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, action: "updated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "cancel" && googleEventId) {
        // Cancel (set status cancelled) in Google
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          }
        );
        if (!res.ok) console.error("Google cancel error:", await res.text());

        return new Response(JSON.stringify({ success: true, action: "cancelled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "delete" && googleEventId) {
        // Delete from Google Calendar
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!res.ok && res.status !== 410) {
          console.error("Google delete error:", await res.text());
        }

        return new Response(JSON.stringify({ success: true, action: "deleted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If action but no google_event_id, just return ok
      return new Response(JSON.stringify({ success: true, action: "no_google_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- FULL SYNC ---

    // --- STEP 1: Push local events to Google ---
    const { data: localEvents } = await supabase
      .from("calendar_events")
      .select("*")
      .is("google_event_id", null)
      .eq("source", "local")
      .neq("meeting_type", "physical")
      .gte("start_time", new Date(Date.now() - 7 * 86400000).toISOString());

    let pushed = 0;
    for (const ev of (localEvents || [])) {
      const body: any = {
        summary: ev.title,
        description: [ev.description, ev.notes ? `Observações:\n${ev.notes}` : null].filter(Boolean).join("\n\n---\n") || "",
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
        const meetLink = created.hangoutLink || created.htmlLink || null;
        await supabase.from("calendar_events").update({
          meet_link: meetLink || ev.meet_link,
          google_event_id: created.id,
        }).eq("id", ev.id);
        pushed++;
      }
    }

    // --- STEP 2: Push local updates to Google (events with google_event_id that were modified) ---
    // This is handled by specific action calls, so skip in full sync

    // --- STEP 3: Pull Google events to local ---
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
      if (!gEvent.start?.dateTime || !gEvent.end?.dateTime) continue;
      if (gEvent.status === "cancelled") continue;

      const googleId = gEvent.id;

      // Check if already exists locally by google_event_id
      const { data: existingById } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("google_event_id", googleId)
        .limit(1);

      if (existingById && existingById.length > 0) continue;

      // Also check by meet_link
      if (gEvent.hangoutLink) {
        const { data: byLink } = await supabase
          .from("calendar_events")
          .select("id")
          .eq("meet_link", gEvent.hangoutLink)
          .limit(1);
        if (byLink && byLink.length > 0) {
          // Update with google_event_id
          await supabase.from("calendar_events").update({ google_event_id: googleId }).eq("id", byLink[0].id);
          continue;
        }
      }

      // Check by title + start_time
      const { data: byTitle } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("title", gEvent.summary || "Evento Google Calendar")
        .eq("start_time", gEvent.start.dateTime)
        .limit(1);

      if (byTitle && byTitle.length > 0) {
        await supabase.from("calendar_events").update({ google_event_id: googleId }).eq("id", byTitle[0].id);
        continue;
      }

      // Insert new local event from Google
      await supabase.from("calendar_events").insert({
        title: gEvent.summary || "Evento Google Calendar",
        description: gEvent.description || null,
        start_time: gEvent.start.dateTime,
        end_time: gEvent.end.dateTime,
        location: gEvent.location || null,
        meet_link: gEvent.hangoutLink || gEvent.htmlLink || null,
        client_email: gEvent.attendees?.[0]?.email || null,
        client_name: gEvent.attendees?.[0]?.displayName || null,
        status: "confirmed",
        notes: `[Importado do Google Calendar] ${gEvent.description || ""}`.trim(),
        google_event_id: googleId,
        source: "google",
      });
      pulled++;
    }

    // --- STEP 4: Sync cancellations from Google ---
    const { data: localConfirmed } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, google_event_id, status")
      .in("status", ["confirmed", "scheduled"])
      .eq("source", "google")
      .not("google_event_id", "is", null)
      .gte("start_time", timeMin)
      .lte("start_time", timeMax);

    let cancelled = 0;
    for (const ev of (localConfirmed || [])) {
      if (!ev.google_event_id) continue;
      try {
        const checkRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(ev.google_event_id)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (checkRes.ok) {
          const gEvent = await checkRes.json();
          if (gEvent.status === "cancelled") {
            // Event cancelled on Google → delete locally
            await supabase.from("calendar_events").delete().eq("id", ev.id);
            cancelled++;
          }
        } else if (checkRes.status === 404 || checkRes.status === 410) {
          // Event was deleted from Google → delete locally
          await supabase.from("calendar_events").delete().eq("id", ev.id);
          cancelled++;
        }
      } catch (e) {
        console.error(`Error checking Google event ${ev.google_event_id}:`, e);
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
