import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RestauracaoItem {
  numero: string;
  data_exclusao: string; // ISO
}

interface RequestBody {
  numeros: RestauracaoItem[];
  recipients?: string[]; // optional override
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Não autorizado");

    const body = (await req.json()) as RequestBody;
    if (!body.numeros || !Array.isArray(body.numeros) || body.numeros.length === 0) {
      throw new Error("Lista de números vazia");
    }

    // Reuse Gmail credentials from consulta_numeros_reminder_config
    const { data: cfg, error: cfgError } = await supabase
      .from("consulta_numeros_reminder_config")
      .select("gmail_user, gmail_app_password, gmail_recipients")
      .single();

    if (cfgError) throw new Error("Erro ao buscar configurações de e-mail");

    const gmailUser = cfg?.gmail_user;
    const gmailAppPassword = cfg?.gmail_app_password;
    const recipients = (body.recipients && body.recipients.length > 0)
      ? body.recipients
      : (cfg?.gmail_recipients || []);

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Credenciais de e-mail não configuradas em Consulta de Números > Lembretes");
    }
    if (!recipients || recipients.length === 0) {
      throw new Error("Nenhum destinatário configurado em Consulta de Números > Lembretes");
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailAppPassword },
      },
    });

    const count = body.numeros.length;
    const subject = `🔄 ${count} número(s) interno(s) para tentativa de desbanimento`;

    const rows = body.numeros
      .map((n) => {
        const data = n.data_exclusao
          ? new Date(n.data_exclusao).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
          : "-";
        return `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${n.numero}</td><td style="padding:8px;border:1px solid #e5e7eb;">${data}</td></tr>`;
      })
      .join("");

    const html = `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;">Números internos para desbanimento</h1>
  </div>
  <div style="background:#f9fafb;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p>Segue abaixo a lista de <strong>${count}</strong> número(s) interno(s) que estão na fila de restauração e precisam de tentativa de desbanimento:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr style="background:#e0f2fe;">
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Número</th>
          <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Data de exclusão</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:11px;color:#9ca3af;text-align:center;">Status de Números — aproveitando credenciais da Consulta de Números</p>
  </div>
</body></html>`.trim();

    const textBody = body.numeros
      .map((n) => `- ${n.numero} (excluído em ${n.data_exclusao ? new Date(n.data_exclusao).toLocaleString("pt-BR") : "-"})`)
      .join("\n");

    await client.send({
      from: gmailUser,
      to: recipients,
      subject,
      content: `Números para desbanimento:\n\n${textBody}`,
      html,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, sent_to: recipients, count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[send-restauracao-email] Erro:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
