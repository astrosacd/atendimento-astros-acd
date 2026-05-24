import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar credenciais do recovery_config (igual ao send-welcome)
    const { data: configs } = await supabase
      .from("recovery_config")
      .select("config_key, config_value");

    const configMap: Record<string, string> = {};
    configs?.forEach((c: { config_key: string; config_value: string }) => {
      configMap[c.config_key] = c.config_value;
    });

    const gmailUser = configMap["gmail_user"];
    const gmailAppPassword = configMap["gmail_app_password"];

    if (!gmailUser || !gmailAppPassword) {
      console.error("Missing Gmail credentials in recovery_config");
      throw new Error("Credenciais de email não configuradas. Configure em Admin > Boas-vindas.");
    }

    console.log(`Using Gmail credentials from recovery_config: ${gmailUser}`);

    const { userId, email, userName } = await req.json();

    if (!userId || !email) {
      throw new Error("userId e email são obrigatórios");
    }

    console.log(`Generating password reset token for user: ${userId}`);

    // Generate a secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    // Store the token in the database using the secure function
    const { data: tokenCreated, error: tokenError } = await supabase.rpc(
      'create_password_reset_token',
      {
        p_user_id: userId,
        p_email: email,
        p_token: token,
        p_expires_at: expiresAt.toISOString(),
      }
    );

    if (tokenError || !tokenCreated) {
      console.error("Error creating token:", tokenError);
      throw new Error("Limite de solicitações atingido. Tente novamente mais tarde.");
    }

    // Create the reset link pointing to the app's redefinir-senha page
    const appUrl = "https://atendimento-astros-acd.lovable.app";
    const resetLink = `${appUrl}/redefinir-senha?token=${token}`;

    console.log(`Sending password reset email to: ${email}`);

    // Send email using Gmail SMTP
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

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0;">Recuperação de Senha</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
    <p style="font-size: 16px; color: #374151;">Olá, <strong>${userName || 'Usuário'}</strong>!</p>
    <p style="font-size: 14px; color: #6b7280;">Você solicitou a recuperação da sua senha. Clique no botão abaixo para criar uma nova senha:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Redefinir Senha</a>
    </div>
    <p style="font-size: 12px; color: #9ca3af;">Este link expira em 1 hora.</p>
    <p style="font-size: 12px; color: #9ca3af;">Se você não solicitou esta recuperação, ignore este email.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 11px; color: #9ca3af; text-align: center;">Sistema de Gerenciamento de Clientes - Astros</p>
  </div>
</body>
</html>
    `.trim();

    await client.send({
      from: gmailUser,
      to: email,
      subject: "Recuperação de Senha - Sistema Astros",
      content: "Clique no link para redefinir sua senha",
      html: emailHtml,
    });

    await client.close();

    console.log(`Password reset email sent successfully to: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email de recuperação enviado com sucesso" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-password-reset-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
