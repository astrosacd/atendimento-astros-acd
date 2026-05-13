import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RestauracaoItem {
  numero: string;
  data_exclusao: string; // ISO
}

interface RequestBody {
  numeros: RestauracaoItem[];
  channel?: "email" | "whatsapp"; // default: email (compat)
  recipients?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Não autorizado");

    const body = (await req.json()) as RequestBody;
    if (!body.numeros || !Array.isArray(body.numeros) || body.numeros.length === 0) {
      throw new Error("Lista de números vazia");
    }
    const channel = body.channel || "email";

    const { data: cfg, error: cfgError } = await supabase
      .from("consulta_numeros_reminder_config")
      .select("gmail_user, gmail_app_password, gmail_recipients, evolution_api_url, evolution_api_key, evolution_instance_name, whatsapp_group_id, whatsapp_mention_all")
      .single();

    if (cfgError) throw new Error("Erro ao buscar configurações");

    const count = body.numeros.length;
    const fmtDate = (iso: string) =>
      iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-";

    if (channel === "whatsapp") {
      const url = cfg?.evolution_api_url;
      const apiKey = cfg?.evolution_api_key;
      const instance = cfg?.evolution_instance_name;
      const groupId = cfg?.whatsapp_group_id;
      const mentionAll = cfg?.whatsapp_mention_all ?? true;

      if (!url || !apiKey || !instance || !groupId) {
        throw new Error("WhatsApp não configurado em Consulta de Números → Lembretes (URL, API Key, instância e grupo)");
      }

      const lines = body.numeros
        .map((n) => `• ${n.numero} — excluído em ${fmtDate(n.data_exclusao)}`)
        .join("\n");
      const text = `🔄 *${count} número(s) interno(s) para tentativa de desbanimento*\n\n${lines}`;

      const baseUrl = url.replace(/\/$/, "");
      const endpoint = `${baseUrl}/message/sendText/${instance}`;

      const payload: Record<string, unknown> = {
        number: groupId,
        text,
      };
      if (mentionAll) {
        payload.mentionsEveryOne = true;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Evolution API erro ${res.status}: ${errText}`);
      }

      return new Response(
        JSON.stringify({ success: true, channel: "whatsapp", count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // === EMAIL ===
    const gmailUser = cfg?.gmail_user;
    const gmailAppPassword = cfg?.gmail_app_password;
    const recipients = (body.recipients && body.recipients.length > 0)
      ? body.recipients
      : (cfg?.gmail_recipients || []);

    if (!gmailUser || !gmailAppPassword) {
      throw new Error("Credenciais de e-mail não configuradas em Consulta de Números → Lembretes");
    }
    if (!recipients || recipients.length === 0) {
      throw new Error("Nenhum destinatário configurado em Consulta de Números → Lembretes");
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailAppPassword },
      },
    });

    const subject = `🔄 ${count} número(s) interno(s) para tentativa de desbanimento`;
    const rows = body.numeros
      .map((n) =>
        `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${n.numero}</td><td style="padding:8px;border:1px solid #e5e7eb;">${fmtDate(n.data_exclusao)}</td></tr>`
      )
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
      .map((n) => `- ${n.numero} (excluído em ${fmtDate(n.data_exclusao)})`)
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
      JSON.stringify({ success: true, channel: "email", sent_to: recipients, count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[send-restauracao-email] Erro:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
