import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface CalendarEventRequest {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  attendee_email?: string;
  calendar_event_id: string;
  notes?: string;
}

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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to refresh Google token: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CalendarEventRequest = await req.json();

    // Get the event's notes for description
    let eventNotes = body.notes || "";
    if (!eventNotes && body.calendar_event_id) {
      const { data: evData } = await supabase
        .from("calendar_events")
        .select("notes")
        .eq("id", body.calendar_event_id)
        .single();
      eventNotes = evData?.notes || "";
    }

    // Get Google Calendar config
    const { data: configs } = await supabase
      .from("calendar_config")
      .select("config_key, config_value");

    const configMap: Record<string, string> = {};
    configs?.forEach((c: any) => {
      configMap[c.config_key] = c.config_value;
    });

    const clientId = configMap.google_client_id;
    const clientSecret = configMap.google_client_secret;
    const refreshToken = configMap.google_refresh_token;
    const calendarId = configMap.google_calendar_id || "primary";

    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(
        JSON.stringify({ error: "Google Calendar não está configurado. Configure as credenciais nas configurações da Agenda." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // Build description with notes
    const descriptionParts = [body.description || ""];
    const cleanNotes = (eventNotes || "").split("\n").filter((l: string) => !l.startsWith("[NOTIFICADO")).join("\n").trim();
    if (cleanNotes) {
      descriptionParts.push(`Observações:\n${cleanNotes}`);
    }
    const fullDescription = descriptionParts.filter(Boolean).join("\n\n---\n");

    // Create Google Calendar event with Meet
    const attendees = body.attendee_email ? [{ email: body.attendee_email }] : [];

    const calendarEvent = {
      summary: body.title,
      description: fullDescription,
      start: {
        dateTime: body.start_time,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: body.end_time,
        timeZone: "America/Sao_Paulo",
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    };

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error("Google Calendar API error:", errText);
      return new Response(
        JSON.stringify({ error: `Erro ao criar evento no Google Calendar: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calData = await calRes.json();
    const meetLink = calData.hangoutLink || null;
    const googleEventId = calData.id || null;

    // Update our calendar_events table with the meet link and google event id
    if (body.calendar_event_id) {
      await supabase
        .from("calendar_events")
        .update({ 
          meet_link: meetLink,
          google_event_id: googleEventId,
        })
        .eq("id", body.calendar_event_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        meet_link: meetLink,
        google_event_id: googleEventId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
