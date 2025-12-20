import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  email: string;
  nome: string;
  numero: string;
  imageBase64: string;
  imageName: string;
  imageType: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email config from consulta_numeros_config
    const { data: configs, error: configError } = await supabase
      .from("consulta_numeros_config")
      .select("config_key, config_value");

    if (configError) {
      console.error("Error fetching config:", configError);
      throw new Error("Erro ao buscar configurações");
    }

    const configMap: Record<string, string> = {};
    configs?.forEach((c: { config_key: string; config_value: string }) => {
      configMap[c.config_key] = c.config_value;
    });

    // Check if email is enabled
    if (configMap["email_enabled"] !== "true") {
      console.log("Email sending is disabled");
      return new Response(
        JSON.stringify({ success: true, message: "Email desativado nas configurações" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gmailUser = configMap["email_gmail_user"];
    const gmailAppPassword = configMap["email_gmail_app_password"];

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Credenciais de email não configuradas. Configure em Configurações > Email.");
    }

    console.log(`Using Gmail: ${gmailUser}`);

    // Parse request body
    const body: EmailRequest = await req.json();
    const { email, nome, numero, imageBase64, imageName, imageType } = body;

    if (!email || !imageBase64) {
      throw new Error("Email e imagem são obrigatórios");
    }

    // Get email templates
    let subject = configMap["email_subject_template"] || "Desbanimento - {{numero}}";
    let htmlBody = configMap["email_body_template"] || 
      "<p>Olá {{nome}},</p><p>Seu número {{numero}} foi desbanido com sucesso.</p>";

    // Replace variables
    subject = subject.replace(/\{\{numero\}\}/g, numero || "").replace(/\{\{nome\}\}/g, nome || "");
    htmlBody = htmlBody.replace(/\{\{numero\}\}/g, numero || "").replace(/\{\{nome\}\}/g, nome || "");

    console.log(`Sending desbanimento email to: ${email}`);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword,
        },
      },
    });

    // Decode base64 image
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Send email with attachment
    await client.send({
      from: gmailUser,
      to: email,
      subject: subject,
      content: "Veja o anexo para mais informações.",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0;">Desbanimento Concluído</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
    ${htmlBody}
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      <strong>Confira o comprovante em anexo.</strong>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 11px; color: #9ca3af; text-align: center;">Sistema de Consulta de Números</p>
  </div>
</body>
</html>
      `.trim(),
      attachments: [
        {
          filename: imageName || "comprovante.png",
          content: imageBytes,
          contentType: imageType || "image/png",
          encoding: "binary" as const,
        },
      ],
    });

    await client.close();

    console.log(`Desbanimento email sent successfully to: ${email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-desbanimento-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
