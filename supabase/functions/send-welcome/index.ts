import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface WelcomeRequest {
  userName: string;
  userEmail: string;
  userPassword: string;
  userPhone?: string;
  sendEmail: boolean;
  sendWhatsapp: boolean;
  updatePassword?: boolean;
  userId?: string;
}

interface TestRequest {
  testMode: boolean;
  channel: 'email' | 'whatsapp';
  to: string;
  subject?: string;
  message: string;
  gmailUser?: string;
  gmailPassword?: string;
  whatsappInstance?: {
    instance_name: string;
    api_url: string;
    api_key: string;
  };
}

// Function to send email via Gmail SMTP
async function sendEmailViaSMTP(
  gmailUser: string,
  gmailPassword: string,
  to: string,
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

    await client.send({
      from: gmailUser,
      to: to,
      subject: subject,
      content: body,
    });

    await client.close();
    
    console.log(`Email sent successfully to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error("SMTP Error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Authentication: require admin JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem executar esta função." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // --- End authentication ---

    const requestBody = await req.json();
    
    // Handle test mode
    if (requestBody.testMode) {
      const { channel, to, subject, message, gmailUser, gmailPassword, whatsappInstance }: TestRequest = requestBody;
      
      console.log(`Test mode: Sending ${channel} to ${to}`);
      
      if (channel === 'email') {
        // Send test email via SMTP
        if (!gmailUser || !gmailPassword) {
          throw new Error("Gmail credentials required for email test");
        }
        
        // Para emails de TESTE, adiciona [TESTE] no assunto para diferenciar
        const rawSubject = subject || 'Teste de Boas-vindas';
        const emailSubject = `[TESTE] ${rawSubject.replace(/^\s*\[TESTE\]\s*/gi, "").trim()}`;
        console.log(`Test email subject: ${emailSubject}`);
        
        const emailResult = await sendEmailViaSMTP(
          gmailUser,
          gmailPassword,
          to,
          emailSubject,
          message
        );
        
        if (!emailResult.success) {
          throw new Error(emailResult.error || "Falha ao enviar e-mail");
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `E-mail de teste enviado para ${to}`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (channel === 'whatsapp') {
        // Send test WhatsApp
        if (!whatsappInstance) {
          throw new Error("WhatsApp instance required for WhatsApp test");
        }
        
        let formattedPhone = to.replace(/\D/g, "");
        if (!formattedPhone.startsWith("55")) {
          formattedPhone = "55" + formattedPhone;
        }
        
        const response = await fetch(`${whatsappInstance.api_url}/message/sendText/${whatsappInstance.instance_name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": whatsappInstance.api_key,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: `[TESTE]\n\n${message}`,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`WhatsApp API error: ${errorText}`);
        }
        
        console.log(`Test WhatsApp sent to: ${formattedPhone}`);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Mensagem WhatsApp de teste enviada para ${to}` 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Normal welcome message flow
    const { userName, userEmail, userPassword, userPhone, sendEmail, sendWhatsapp, updatePassword, userId }: WelcomeRequest = requestBody;
    
    console.log(`Processing welcome message for: ${userEmail}`);
    
    // If updatePassword is true and userId is provided, update the user's password
    if (updatePassword && userId) {
      try {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          userId,
          { password: userPassword }
        );
        
        if (passwordError) {
          console.error('Error updating user password:', passwordError);
        } else {
          console.log('User password updated successfully');
        }
      } catch (pwError) {
        console.error('Exception updating password:', pwError);
      }
    }
    
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

    // Buscar o código de acesso do banco de dados
    const { data: accessCodeData } = await supabase
      .from('gateway_settings')
      .select('value')
      .eq('key', 'auth_access_code')
      .maybeSingle();
    
    const accessCode = accessCodeData?.value?.code || 'astros2024';
    const baseUrl = "https://atendimento-astros-acd.lovable.app";
    const authUrl = `${baseUrl}/auth?codigo=${accessCode}`;

    // Replace template variables
    const replaceVariables = (template: string) => {
      return template
        .replace(/{nome}/g, userName)
        .replace(/{email}/g, userEmail)
        .replace(/{senha}/g, userPassword)
        .replace(/{url}/g, authUrl);
    };

    // Send Email if enabled
    if (sendEmail && configMap["welcome_email_enabled"] === "true") {
      const gmailUser = configMap["gmail_user"];
      const gmailPassword = configMap["gmail_app_password"];

      if (gmailUser && gmailPassword) {
        try {
          const rawSubject = configMap["welcome_email_subject"] || "Bem-vindo ao Sistema Astros!";
          // Remove qualquer ocorrência de [TESTE] configurada no assunto e no corpo para os envios reais
          const emailSubject = rawSubject.replace(/\[TESTE\]/gi, "").trim();
          const rawTemplate = configMap["welcome_email_template"] || `Olá ${userName}, sua conta foi criada!`;
          const cleanedTemplate = rawTemplate.replace(/\[TESTE\]/gi, "").trim();
          const emailBody = replaceVariables(cleanedTemplate);

          console.log(`Sending REAL welcome email to ${userEmail} with subject: ${emailSubject}`);
          
          const emailResult = await sendEmailViaSMTP(
            gmailUser,
            gmailPassword,
            userEmail,
            emailSubject,
            emailBody
          );
          
          if (emailResult.success) {
            results.email.sent = true;
          } else {
            results.email.error = emailResult.error || "Falha ao enviar e-mail";
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
        const rawWhatsappTemplate = configMap["welcome_whatsapp_template"] || `Olá {nome}, sua conta foi criada!`;
        const cleanedWhatsappTemplate = rawWhatsappTemplate.replace(/\[TESTE\]/gi, "").trim();
        const message = replaceVariables(cleanedWhatsappTemplate);

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
