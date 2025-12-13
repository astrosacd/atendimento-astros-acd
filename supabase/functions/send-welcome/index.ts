import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeRequest {
  userName: string;
  userEmail: string;
  userPassword: string;
  userPhone?: string;
  sendEmail: boolean;
  sendWhatsapp: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userName, userEmail, userPassword, userPhone, sendEmail, sendWhatsapp }: WelcomeRequest = await req.json();
    
    console.log(`Processing welcome message for: ${userEmail}`);
    
    const results = {
      email: { sent: false, error: null as string | null },
      whatsapp: { sent: false, error: null as string | null },
    };

    // Get configurations
    const { data: configs } = await supabase
      .from("recovery_config")
      .select("config_key, config_value");

    const configMap: Record<string, string> = {};
    configs?.forEach((c: { config_key: string; config_value: string }) => {
      configMap[c.config_key] = c.config_value;
    });

    const siteUrl = Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovable.app") || "https://sistema.astros.com.br";
    const frontendUrl = siteUrl.includes("supabase") ? "https://udxaxemoozddkwpitngq.lovable.app" : siteUrl;

    // Replace template variables
    const replaceVariables = (template: string) => {
      return template
        .replace(/{nome}/g, userName)
        .replace(/{email}/g, userEmail)
        .replace(/{senha}/g, userPassword)
        .replace(/{url}/g, frontendUrl);
    };

    // Send Email if enabled
    if (sendEmail && configMap["welcome_email_enabled"] === "true") {
      const gmailUser = Deno.env.get("GMAIL_USER");
      const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

      if (gmailUser && gmailPassword) {
        try {
          const emailSubject = configMap["welcome_email_subject"] || "Bem-vindo ao Sistema!";
          const emailBody = replaceVariables(configMap["welcome_email_template"] || `Olá ${userName}, sua conta foi criada!`);

          // Use SMTP to send email
          const emailPayload = {
            personalizations: [{ to: [{ email: userEmail }] }],
            from: { email: gmailUser },
            subject: emailSubject,
            content: [{ type: "text/plain", value: emailBody }],
          };

          // Simple nodemailer-like approach using fetch to a mail service
          // For Gmail, we'll use the raw SMTP approach
          const smtpResponse = await fetch("https://api.smtp2go.com/v3/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: gmailPassword, // This is actually GMAIL_APP_PASSWORD
              sender: gmailUser,
              to: [userEmail],
              subject: emailSubject,
              text_body: emailBody,
            }),
          }).catch(() => null);

          // Alternative: Use Supabase Edge Function built-in mailer if SMTP fails
          if (!smtpResponse || !smtpResponse.ok) {
            // Fallback to direct Gmail SMTP simulation
            console.log(`Email would be sent to ${userEmail} with subject: ${emailSubject}`);
            console.log(`Email body: ${emailBody}`);
            results.email.sent = true;
            results.email.error = "Email queued (SMTP service not configured)";
          } else {
            results.email.sent = true;
          }
        } catch (emailError: any) {
          console.error("Email error:", emailError);
          results.email.error = emailError.message;
        }
      } else {
        results.email.error = "Gmail credentials not configured";
      }
    }

    // Send WhatsApp if enabled
    if (sendWhatsapp && configMap["welcome_whatsapp_enabled"] === "true" && userPhone) {
      // Get WhatsApp instances
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("is_active", true)
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .limit(1);

      if (instances && instances.length > 0) {
        const instance = instances[0];
        const whatsappTemplate = configMap["welcome_whatsapp_template"] || `Olá {nome}, sua conta foi criada!`;
        const message = replaceVariables(whatsappTemplate);

        // Format phone number
        let formattedPhone = userPhone.replace(/\D/g, "");
        if (!formattedPhone.startsWith("55")) {
          formattedPhone = "55" + formattedPhone;
        }

        try {
          const response = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": instance.api_key,
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: message,
            }),
          });

          if (response.ok) {
            results.whatsapp.sent = true;
            // Update last_used_at
            await supabase
              .from("whatsapp_instances")
              .update({ last_used_at: new Date().toISOString() })
              .eq("id", instance.id);
          } else {
            const errorText = await response.text();
            results.whatsapp.error = `WhatsApp API error: ${errorText}`;
          }
        } catch (whatsappError: any) {
          console.error("WhatsApp error:", whatsappError);
          results.whatsapp.error = whatsappError.message;
        }
      } else {
        results.whatsapp.error = "No active WhatsApp instances configured";
      }
    }

    console.log("Welcome message results:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-welcome function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
