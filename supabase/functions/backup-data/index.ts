import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface BackupOptions {
  includeLogs?: boolean;
  sendEmail?: boolean;
  emailRecipients?: string[];
  sendWhatsApp?: boolean;
  whatsappRecipients?: string[];
  whatsappInstanceId?: string;
}

interface BackupResult {
  success: boolean;
  tables: string[];
  totalRecords: number;
  backupDate: string;
  downloadUrl?: string;
  storagePath?: string;
  emailResults?: any;
  whatsappResults?: any;
  error?: string;
}

// Function to send email via Gmail SMTP
async function sendEmailViaSMTP(
  gmailUser: string,
  gmailPassword: string,
  to: string[],
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });

    for (const recipient of to) {
      await client.send({
        from: gmailUser,
        to: recipient,
        subject: subject,
        content: body,
      });
    }

    await client.close();
    return { success: true };
  } catch (error: any) {
    console.error("SMTP Error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify authentication
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

    // Get options
    let options: BackupOptions = {};
    try {
      const body = await req.json();
      options = body;
    } catch {
      // Default options
    }

    console.log("Starting full backup with options:", options);

    // Get all public tables
    let allTables: string[] = [];
    const { data: tablesData, error: tablesError } = await supabaseAdmin.rpc('get_public_tables');
    
    if (tablesError) {
      console.warn("RPC get_public_tables failed:", tablesError);
    } else if (Array.isArray(tablesData)) {
      allTables = tablesData
        .map((t: any) => typeof t === 'string' ? t : (t?.table_name ?? t?.tablename ?? null))
        .filter((t: any): t is string => typeof t === 'string' && t.length > 0);
    }

    if (allTables.length === 0) {
      // Emergency fallback list
      allTables = ["clientes", "profiles", "user_roles", "billing_config"];
    }

    if (allTables.length === 0) {
      // Emergency fallback list
      allTables = ["clientes", "profiles", "user_roles", "billing_config"];
    }

    // Filter tables
    const heavyTables = [
      "audit_logs", "billing_logs", "chat_messages", "client_history", 
      "proposal_views", "integration_logs", "automation_logs", 
      "client_followup_logs", "client_ai_logs", "client_recovery_webhook_logs",
      "consulta_numeros_history", "divulgador_operation_logs", 
      "divulgador_send_logs", "lead_hunter_leads", "lead_hunter_logs", 
      "ligacoes_ia_historico", "gateway_events", "billing_webhook_logs",
      "chamados_webhook_logs", "followup_webhook_logs", "atomicat_submissions",
      "calendar_notification_logs", "cobranca_ligacao_logs", "ig_auto_reply_history",
      "numeros_aquecimento_history"
    ];

    const tablesToBackup = allTables.filter(table => {
      if (options.includeLogs) return true;
      
      const lowerTable = table.toLowerCase();
      const isHeavy = heavyTables.includes(lowerTable) || 
                      lowerTable.endsWith("_logs") || 
                      lowerTable.endsWith("_history") ||
                      lowerTable.endsWith("_webhook_logs");
      
      return !isHeavy;
    });

    console.log(`Backing up ${tablesToBackup.length} tables...`);

    const backupData: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const table of tablesToBackup) {
      try {
        // We might want to limit large tables or do pagination, but for JSON backup SELECT * is standard
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
    const backupContent = JSON.stringify({
      metadata: {
        date: backupDate,
        tables: tablesToBackup,
        totalRecords,
        generatedBy: user.email,
        includesLogs: !!options.includeLogs
      },
      data: backupData,
    }, null, 2);

    // Upload to Storage
    const fileName = `backup-${backupDate.replace(/[:.]/g, '-')}.json`;
    const storagePath = `backups/${fileName}`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('backups')
      .upload(fileName, new Blob([backupContent], { type: 'application/json' }), {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Failed to upload backup to storage: ${uploadError.message}`);
    }

    // Generate signed URL (7 days = 604800 seconds)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('backups')
      .createSignedUrl(fileName, 604800);

    if (signedError) {
      console.error("Signed URL error:", signedError);
      throw new Error(`Failed to generate signed URL: ${signedError.message}`);
    }

    const downloadUrl = signedData.signedUrl;
    const emailResults: any = { sent: false };
    const whatsappResults: any = { sent: false };

    // Handle Email
    if (options.sendEmail && options.emailRecipients && options.emailRecipients.length > 0) {
      const { data: configs } = await supabaseAdmin
        .from("recovery_config")
        .select("config_key, config_value")
        .in("config_key", ["gmail_user", "gmail_app_password"]);

      const configMap: Record<string, string> = {};
      configs?.forEach((c: any) => configMap[c.config_key] = c.config_value);

      if (configMap["gmail_user"] && configMap["gmail_app_password"]) {
        const subject = `Backup do Sistema Astros - ${new Date().toLocaleDateString('pt-BR')}`;
        const body = `Olá,\n\nO backup do sistema foi gerado com sucesso.\n\nDetalhes:\n- Data: ${new Date().toLocaleString('pt-BR')}\n- Tabelas: ${tablesToBackup.length}\n- Registros: ${totalRecords}\n\nVocê pode baixar o arquivo pelo link abaixo (válido por 7 dias):\n${downloadUrl}\n\nAtenciosamente,\nEquipe Astros`;
        
        const emailRes = await sendEmailViaSMTP(
          configMap["gmail_user"],
          configMap["gmail_app_password"],
          options.emailRecipients,
          subject,
          body
        );
        emailResults.sent = emailRes.success;
        if (!emailRes.success) emailResults.error = emailRes.error;
      } else {
        emailResults.error = "Credenciais Gmail não configuradas";
      }
    }

    // Handle WhatsApp
    if (options.sendWhatsApp && options.whatsappRecipients && options.whatsappRecipients.length > 0) {
      const { data: instances } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("*")
        .eq("is_active", true);

      let instance = instances?.find(i => i.id === options.whatsappInstanceId);
      if (!instance && instances && instances.length > 0) {
        instance = instances[0];
      }

      if (instance) {
        for (const recipient of options.whatsappRecipients) {
          let formattedPhone = recipient.replace(/\D/g, "");
          if (!formattedPhone.startsWith("55")) formattedPhone = "55" + formattedPhone;

          try {
            const message = `*Backup do Sistema Astros*\n\nData: ${new Date().toLocaleString('pt-BR')}\nTabelas: ${tablesToBackup.length}\nRegistros: ${totalRecords}\n\nBaixar arquivo (válido por 7 dias):\n${downloadUrl}`;
            
            await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": instance.api_key },
              body: JSON.stringify({ number: formattedPhone, text: message }),
            });
          } catch (e) {
            console.error(`WhatsApp error for ${recipient}:`, e);
            whatsappResults.error = e.message;
          }
        }
        whatsappResults.sent = true;
      } else {
        whatsappResults.error = "Nenhuma instância WhatsApp ativa";
      }
    }

    return new Response(JSON.stringify({
      success: true,
      tables: tablesToBackup,
      totalRecords,
      backupDate,
      downloadUrl,
      storagePath,
      emailResults,
      whatsappResults
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Backup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});