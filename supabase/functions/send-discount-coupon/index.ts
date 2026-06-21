import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface Payload {
  clienteId: string;
  discountPercent: number;
  paymentUrl: string;
  message: string;
  channels: Array<"whatsapp" | "email">;
  subject?: string;
}

const sendWhatsAppMessage = async (
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  message: string,
): Promise<{ success: boolean; error?: string }> => {
  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const url = `${apiUrl}/message/sendText/${instanceName}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: cleanNumber, text: message }),
    });
    const text = await response.text();
    if (!response.ok) return { success: false, error: `HTTP ${response.status}: ${text}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
};

const sendEmailViaSMTP = async (
  gmailUser: string,
  gmailPassword: string,
  senderName: string,
  to: string,
  subject: string,
  message: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailPassword },
      },
    });
    const from = senderName ? `${senderName} <${gmailUser}>` : gmailUser;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap;">${
      message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")
    }</div>`;
    await client.send({ from, to, subject, content: message, html });
    await client.close();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: Payload = await req.json();
    const { clienteId, discountPercent, paymentUrl, message, channels, subject } = body;

    if (!clienteId || !paymentUrl || !message || !Array.isArray(channels) || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: "clienteId, paymentUrl, message e channels são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cliente, error: cliErr } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", clienteId)
      .single();
    if (cliErr || !cliente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🛡️ Anti-abuso: 1 cupom a cada 30 dias por cliente
    const COOLDOWN_DAYS = 30;
    const cutoff = new Date(Date.now() - COOLDOWN_DAYS * 86400000).toISOString();
    const { data: recentCoupons } = await supabase
      .from("billing_logs")
      .select("id, sent_at")
      .eq("cliente_id", cliente.id)
      .eq("message_type", "cupom_desconto")
      .eq("status", "sent")
      .gte("sent_at", cutoff)
      .order("sent_at", { ascending: false })
      .limit(1);
    if (recentCoupons && recentCoupons.length > 0) {
      const last = recentCoupons[0];
      const daysSince = Math.floor((Date.now() - new Date(last.sent_at as string).getTime()) / 86400000);
      const daysRemaining = Math.max(0, COOLDOWN_DAYS - daysSince);
      return new Response(
        JSON.stringify({
          error: `Limite anti-abuso: já existe um cupom enviado a este cliente nos últimos ${COOLDOWN_DAYS} dias. Aguarde ${daysRemaining} dia(s).`,
          code: "COUPON_COOLDOWN_ACTIVE",
          last_sent_at: last.sent_at,
          days_remaining: daysRemaining,
          cooldown_days: COOLDOWN_DAYS,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: configRows } = await supabase
      .from("billing_config")
      .select("config_key, config_value");
    const config: Record<string, string> = {};
    configRows?.forEach((r) => (config[r.config_key] = r.config_value));

    const results: Record<string, { sent: boolean; error: string | null }> = {
      whatsapp: { sent: false, error: null },
      email: { sent: false, error: null },
    };

    // WhatsApp
    if (channels.includes("whatsapp")) {
      if (!cliente.numero) {
        results.whatsapp.error = "Cliente sem número de WhatsApp";
      } else {
        const { data: instances } = await supabase
          .from("billing_whatsapp_instances")
          .select("*")
          .eq("is_active", true)
          .limit(1);
        const instance = instances?.[0];
        if (!instance) {
          results.whatsapp.error = "Nenhuma instância WhatsApp ativa em Cobrança";
        } else {
          const r = await sendWhatsAppMessage(
            instance.api_url,
            instance.api_key,
            instance.instance_name,
            cliente.numero,
            message,
          );
          results.whatsapp.sent = r.success;
          results.whatsapp.error = r.error || null;
        }
      }
      await supabase.from("billing_logs").insert({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        cliente_email: cliente.email,
        cliente_numero: cliente.numero,
        message_type: "cupom_desconto",
        channel: "whatsapp",
        status: results.whatsapp.sent ? "sent" : "error",
        error_message: results.whatsapp.error,
      });
    }

    // Email
    if (channels.includes("email")) {
      const gmailUser = config.billing_gmail_user;
      const gmailPassword = config.billing_gmail_password;
      const senderName = config.billing_sender_name || "";
      if (!cliente.email) {
        results.email.error = "Cliente sem e-mail";
      } else if (!gmailUser || !gmailPassword) {
        results.email.error = "Credenciais Gmail não configuradas em Cobrança";
      } else {
        const r = await sendEmailViaSMTP(
          gmailUser,
          gmailPassword,
          senderName,
          cliente.email,
          subject || `🎁 Cupom de desconto exclusivo - ${cliente.produto || "Oferta"}`,
          message,
        );
        results.email.sent = r.success;
        results.email.error = r.error || null;
      }
      await supabase.from("billing_logs").insert({
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        cliente_email: cliente.email,
        cliente_numero: cliente.numero,
        message_type: "cupom_desconto",
        channel: "email",
        status: results.email.sent ? "sent" : "error",
        error_message: results.email.error,
      });
    }

    // Histórico do cliente
    await supabase.from("client_history").insert({
      cliente_id: cliente.id,
      action_type: "cupom_desconto_enviado",
      description: `Cupom de ${discountPercent}% enviado via ${channels.join(", ")}. Link: ${paymentUrl}`,
      performed_by: userData.user.id,
    });

    const anySuccess = Object.values(results).some((r) => r.sent);
    return new Response(
      JSON.stringify({
        success: anySuccess,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[send-discount-coupon] error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
