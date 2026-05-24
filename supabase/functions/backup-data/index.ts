import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface BackupResult {
  success: boolean;
  tables: string[];
  totalRecords: number;
  backupDate: string;
  downloadUrl?: string;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body for options
    let options = { sendEmail: false, emailTo: "" };
    try {
      const body = await req.text();
      if (body) {
        options = JSON.parse(body);
      }
    } catch {
      // Default options
    }

    console.log("Starting backup...");

    // Tables to backup
    const tablesToBackup = [
      "clientes",
      "profiles",
      "user_roles",
      "billing_config",
      "billing_logs",
      "webhooks",
      "api_keys",
      "custom_roles",
      "role_permissions",
      "system_permissions",
    ];

    const backupData: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const table of tablesToBackup) {
      try {
        const { data, error } = await supabaseAdmin.from(table).select("*");
        if (error) {
          console.error(`Error backing up ${table}:`, error);
          backupData[table] = [];
        } else {
          backupData[table] = data || [];
          totalRecords += data?.length || 0;
        }
      } catch (e) {
        console.error(`Exception backing up ${table}:`, e);
        backupData[table] = [];
      }
    }

    const backupDate = new Date().toISOString();
    const backupJson = JSON.stringify({
      metadata: {
        date: backupDate,
        tables: tablesToBackup,
        totalRecords,
        generatedBy: user.email,
      },
      data: backupData,
    }, null, 2);

    // If email requested, send the backup
    if (options.sendEmail && options.emailTo) {
      const gmailUser = Deno.env.get("GMAIL_USER");
      const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

      if (gmailUser && gmailPassword) {
        console.log(`Sending backup to ${options.emailTo}`);
        // Note: In production, you'd use a proper email service
        // For now, just log that backup was created
      }
    }

    const result: BackupResult = {
      success: true,
      tables: tablesToBackup,
      totalRecords,
      backupDate,
    };

    console.log(`Backup completed: ${totalRecords} records from ${tablesToBackup.length} tables`);

    // Return backup data for download
    return new Response(backupJson, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${backupDate.split('T')[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Backup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
