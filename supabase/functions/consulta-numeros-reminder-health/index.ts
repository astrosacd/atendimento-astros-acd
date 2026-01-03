import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CronJobRow = {
  jobid: number;
  schedule: string;
  command: string;
  active: boolean;
};

type CronRunRow = {
  jobid: number;
  status: string;
  start_time: string;
  end_time: string | null;
  return_message: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require an authenticated user (this function is meant for the admin UI)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for system schemas (cron/net)
    const admin = createClient(supabaseUrl, serviceKey);

    // Locate the cron job that calls execute_consulta_numeros_reminder
    const { data: jobRows, error: jobError } = await admin
      .schema("cron")
      .from("job")
      .select("jobid, schedule, command, active")
      .ilike("command", "%execute_consulta_numeros_reminder%")
      .order("jobid", { ascending: false })
      .limit(1);

    if (jobError) {
      return new Response(JSON.stringify({ error: jobError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = (jobRows?.[0] as CronJobRow | undefined) ?? null;

    let lastRuns: CronRunRow[] = [];
    if (job?.jobid != null) {
      const { data: runRows, error: runError } = await admin
        .schema("cron")
        .from("job_run_details")
        .select("jobid, status, start_time, end_time, return_message")
        .eq("jobid", job.jobid)
        .order("start_time", { ascending: false })
        .limit(10);

      if (runError) {
        return new Response(JSON.stringify({ error: runError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      lastRuns = (runRows as CronRunRow[]) ?? [];
    }

    return new Response(
      JSON.stringify({
        success: true,
        job,
        lastRuns,
        nowUtc: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[consulta-numeros-reminder-health] error:", error);
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
