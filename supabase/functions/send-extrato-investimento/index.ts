import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as baseCorsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  ...baseCorsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  channel: "whatsapp" | "email";
  cliente_id?: string;
  cliente_nome: string;
  referencia: string;
  destino: string;
  mensagem?: string;
  assunto?: string;
  pdf_base64: string;
  file_name: string;
  total_investido?: number;
  total_mensal?: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function buildDefaultWhatsAppMessage(b: Body): string {
  const linhas: string[] = [];
  linhas.push(`Olá, ${b.cliente_nome.split(" ")[0] || ""} 👋`);
  linhas.push("");
  linhas.push("Conforme solicitado, segue em anexo o seu *Extrato de Investimento* com a Astros Comunicação Digital.");
  if (b.total_investido != null && b.total_investido > 0) {
    linhas.push("");
    linhas.push(`💰 Total investido: *${fmtBRL(b.total_investido)}*`);
  }
  if (b.total_mensal != null && b.total_mensal > 0) {
    linhas.push(`🔁 Recorrência mensal ativa: *${fmtBRL(b.total_mensal)}/mês*`);
  }
  linhas.push("");
  linhas.push(`📄 Referência: ${b.referencia}`);
  linhas.push("");
  linhas.push("Qualquer dúvida, estamos à disposição. 🙏");
  return linhas.join("\n");
}

// Assunto curto e ASCII-safe: subjects longos com caracteres especiais (—, ·)
// quebram o folding de headers MIME e o cliente exibe o e-mail como texto cru.
function sanitizeSubject(s: string): string {
  return s
    .replace(/[—–]/g, "-")
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function buildDefaultEmailHTML(b: Body): string {
  const greet = `Prezado(a) ${b.cliente_nome.split(" ")[0] || ""},`;
  const customIntro = b.mensagem?.trim()
    ? `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">${b.mensagem.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`
    : "";
  const valorTotal = b.total_investido && b.total_investido > 0
    ? `<p style="margin:8px 0;font-size:15px;"><strong>Total investido:</strong> ${fmtBRL(b.total_investido)}</p>` : "";
  const mensal = b.total_mensal && b.total_mensal > 0
    ? `<p style="margin:8px 0;font-size:15px;"><strong>Recorrência mensal ativa:</strong> ${fmtBRL(b.total_mensal)}/mês</p>` : "";
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <div style="background:#0B1733;padding:24px 28px;">
        <h1 style="margin:0;color:#D4A84B;font-size:18px;letter-spacing:.5px;">ASTROS COMUNICAÇÃO DIGITAL</h1>
        <p style="margin:4px 0 0;color:#C9D2E4;font-size:11px;">Extrato de Investimento</p>
      </div>
      <div style="padding:28px;color:#1F2937;">
        <p style="font-size:16px;margin:0 0 12px;">${greet}</p>
        ${customIntro || `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
          Conforme solicitado, segue em anexo o <strong>extrato consolidado</strong> do seu investimento conosco.
          Este documento reúne todos os serviços contratados, recorrências ativas e o valor total já investido.
        </p>`}
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;padding:14px;margin:16px 0;">
          <p style="margin:0 0 6px;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;"><strong>Referência</strong></p>
          <p style="margin:0;font-size:15px;color:#0B1733;"><strong>${b.referencia}</strong></p>${valorTotal}${mensal}
        </div>
        <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">
          Em caso de dúvidas, basta responder a este e-mail ou nos chamar pelo WhatsApp.
        </p>
        <p style="font-size:14px;margin:24px 0 0;">Atenciosamente,<br/><strong>Equipe Astros</strong></p>
      </div>
      <div style="background:#0B1733;padding:14px 28px;text-align:center;">
        <p style="margin:0;color:#8B97B5;font-size:11px;">www.astroscomunicacaodigital.com  ·  Desde 2020 gerando resultados reais.</p>
      </div>
    </div></body></html>`;
}

async function sendWhatsAppMedia(
  apiUrl: string, apiKey: string, instanceName: string,
  phone: string, pdfBase64: string, fileName: string, caption: string,
): Promise<{ success: boolean; error?: string }> {
  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) cleanNumber = "55" + cleanNumber;

  const url = `${apiUrl}/message/sendMedia/${instanceName}`;
  const body = {
    number: cleanNumber,
    mediatype: "document",
    media: pdfBase64,
    mimetype: "application/pdf",
    fileName: fileName,
    caption: caption,
  };

  const MAX = 3;
  const BACKOFF = [0, 1500, 4000];
  let lastErr = "";
  for (let i = 1; i <= MAX; i++) {
    if (BACKOFF[i - 1] > 0) await new Promise((r) => setTimeout(r, BACKOFF[i - 1]));
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apiKey },
        body: JSON.stringify(body),
      });
      const txt = await resp.text();
      if (resp.ok) return { success: true };
      lastErr = `HTTP ${resp.status}: ${txt}`;
      if (resp.status < 500) return { success: false, error: lastErr };
    } catch (e: any) { lastErr = e?.message || String(e); }
  }
  return { success: false, error: lastErr };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: precisa de usuário logado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const body = (await req.json()) as Body;

    if (!body.channel || !body.pdf_base64 || !body.file_name || !body.destino || !body.cliente_nome || !body.referencia) {
      return new Response(JSON.stringify({ success: false, error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.channel === "whatsapp") {
      const { data: instances } = await admin
        .from("billing_whatsapp_instances")
        .select("*")
        .eq("is_active", true)
        .limit(1);
      const instance = instances?.[0];
      if (!instance) {
        return new Response(JSON.stringify({ success: false, error: "Nenhuma instância WhatsApp ativa em Cobrança" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const caption = body.mensagem?.trim() ? body.mensagem.trim() : buildDefaultWhatsAppMessage(body);
      const r = await sendWhatsAppMedia(
        instance.api_url, instance.api_key, instance.instance_name,
        body.destino, body.pdf_base64, body.file_name, caption,
      );
      if (r.success) {
        await admin.from("billing_whatsapp_instances")
          .update({ last_used_at: new Date().toISOString() }).eq("id", instance.id);
        await admin.from("billing_logs").insert({
          cliente_id: body.cliente_id || null,
          cliente_nome: body.cliente_nome,
          cliente_numero: body.destino,
          message_type: "extrato_investimento",
          channel: "whatsapp",
          status: "sent",
        });
      }
      return new Response(JSON.stringify(r), {
        status: r.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.channel === "email") {
      const { data: configData } = await admin
        .from("billing_config").select("config_key, config_value");
      const cfg: Record<string, string> = {};
      (configData || []).forEach((r: any) => { cfg[r.config_key] = r.config_value; });
      const gmailUser = cfg.billing_gmail_user;
      const gmailPassword = cfg.billing_gmail_password;
      const senderName = cfg.billing_sender_name || "Astros Comunicação Digital";
      if (!gmailUser || !gmailPassword) {
        return new Response(JSON.stringify({ success: false, error: "Credenciais SMTP não configuradas em Cobrança" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const html = buildDefaultEmailHTML(body);
      const subject = sanitizeSubject(
        body.assunto?.trim() || `Extrato de Investimento - ${body.referencia}`,
      );

      const client = new SMTPClient({
        connection: {
          hostname: "smtp.gmail.com", port: 465, tls: true,
          auth: { username: gmailUser, password: gmailPassword },
        },
      });

      try {
        await client.send({
          from: `${senderName} <${gmailUser}>`,
          to: body.destino,
          subject,
          content: "Este email requer um cliente com suporte a HTML.",
          html,
          attachments: [{
            filename: body.file_name,
            content: body.pdf_base64,
            encoding: "base64",
            contentType: "application/pdf",
          }],
        });
        await client.close();
      } catch (err: any) {
        try { await client.close(); } catch { /* ignore */ }
        return new Response(JSON.stringify({ success: false, error: err?.message || "Erro SMTP" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("billing_logs").insert({
        cliente_id: body.cliente_id || null,
        cliente_nome: body.cliente_nome,
        cliente_email: body.destino,
        message_type: "extrato_investimento",
        channel: "email",
        status: "sent",
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Canal inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-extrato-investimento error:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
