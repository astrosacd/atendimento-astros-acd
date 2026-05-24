import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface TestEmailRequest {
  to: string;
  gmailUser?: string;
  gmailAppPassword?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, gmailUser: gmailUserInput, gmailAppPassword: gmailAppPasswordInput }: TestEmailRequest = await req.json();

    if (!to) {
      throw new Error("Informe o email de destino (notificações). ");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Configuração do backend incompleta (SUPABASE_URL / SERVICE_ROLE). ");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // If credentials are not provided, load from recovery_config
    let gmailUser = (gmailUserInput ?? "").trim();
    let gmailAppPassword = (gmailAppPasswordInput ?? "").trim();

    if (!gmailUser || !gmailAppPassword) {
      const { data, error } = await supabase
        .from("recovery_config")
        .select("config_key, config_value")
        .in("config_key", ["gmail_user", "gmail_app_password"]);

      if (error) throw error;

      const config = (data ?? []).reduce((acc: Record<string, string>, item: any) => {
        acc[item.config_key] = item.config_value;
        return acc;
      }, {} as Record<string, string>);

      if (!gmailUser) gmailUser = (config.gmail_user ?? "").trim();
      if (!gmailAppPassword) gmailAppPassword = (config.gmail_app_password ?? "").trim();
    }

    if (!gmailUser || !gmailAppPassword) {
      throw new Error(
        "Credenciais do Gmail não encontradas. Salve a conta e a senha de app e tente novamente."
      );
    }

    console.log(`Sending test email to: ${to} from: ${gmailUser}`);

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

    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    await client.send({
      from: gmailUser,
      to,
      subject: "🧪 Teste de Notificação - API Logs",
      content: "auto",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Teste de Email Bem-Sucedido!</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              Este é um email de teste para confirmar que as notificações de erro da API estão configuradas corretamente.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                <strong>Data/Hora:</strong> ${now}<br>
                <strong>Remetente:</strong> ${gmailUser}<br>
                <strong>Destinatário:</strong> ${to}
              </p>
            </div>
            <p style="color: #64748b; font-size: 14px;">
              Se você recebeu este email, o envio está funcionando.
            </p>
          </div>
        </div>
      `,
    });

    await client.close();

    console.log("Test email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao enviar email de teste",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
