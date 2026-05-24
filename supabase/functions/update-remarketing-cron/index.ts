import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { cron_hour_brt } = await req.json();

    if (cron_hour_brt === undefined || cron_hour_brt < 0 || cron_hour_brt > 23) {
      return new Response(JSON.stringify({ error: "Invalid cron_hour_brt (0-23)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert BRT to UTC (+3)
    const utcHour = (cron_hour_brt + 3) % 24;
    const newSchedule = `0 ${utcHour} * * *`;

    console.log(`🕐 Updating remarketing cron: BRT ${cron_hour_brt}:00 → UTC ${utcHour}:00 → schedule: ${newSchedule}`);

    // Update the existing cron job
    const { error } = await supabase.rpc('update_remarketing_cron_schedule', {
      new_schedule: newSchedule,
    });

    if (error) {
      console.error('❌ Error updating cron:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      schedule: newSchedule,
      brt_hour: cron_hour_brt,
      utc_hour: utcHour,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
