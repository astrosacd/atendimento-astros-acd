import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendWhatsApp(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  text: string,
) {
  const url = `${apiUrl}/message/sendText/${instanceName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: phone.replace(/\D/g, ""), text }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp falhou (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

async function sendEmail(
  cfg: { host: string; port: number; user: string; pass: string; from: string; fromName?: string },
  to: string,
  subject: string,
  html: string,
) {
  const client = new SMTPClient({
    connection: {
      hostname: cfg.host,
      port: cfg.port,
      tls: true,
      auth: { username: cfg.user, password: cfg.pass },
    },
  });
  const from = cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from;
  await client.send({ from, to, subject, content: "Veja o relatório no anexo", html });
  await client.close();
}

function buildReportHTML(profile: any, report: any, publicLink: string) {
  const d = report.data || {};
  const f = d.followers || {};
  const p = d.posts || {};
  const e = d.engagement || {};
  const sign = (n: number | null | undefined) =>
    n == null ? "—" : n > 0 ? `+${n}` : `${n}`;
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
<table width="600" cellspacing="0" cellpadding="0" align="center" style="background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045);padding:30px;text-align:center;color:#fff;">
<h1 style="margin:0;">📊 Relatório Social Media</h1>
<p style="margin:8px 0 0;">${profile.display_name || profile.username} — @${profile.username}</p>
<p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Período: ${report.month}</p>
</td></tr>
<tr><td style="padding:30px;">
<h2 style="margin:0 0 16px;color:#333;">Seguidores</h2>
<table width="100%"><tr>
<td style="padding:10px;background:#f9fafb;border-radius:6px;text-align:center;"><b style="font-size:22px;">${f.end ?? "—"}</b><br><small>Atual</small></td>
<td width="10"></td>
<td style="padding:10px;background:#ecfdf5;border-radius:6px;text-align:center;"><b style="font-size:22px;color:#059669;">${sign(f.gain)}</b><br><small>Saldo do mês</small></td>
<td width="10"></td>
<td style="padding:10px;background:#eff6ff;border-radius:6px;text-align:center;"><b style="font-size:22px;color:#2563eb;">${f.pct_growth != null ? f.pct_growth.toFixed(1) + "%" : "—"}</b><br><small>Crescimento</small></td>
</tr></table>
<h2 style="margin:24px 0 16px;color:#333;">Posts publicados</h2>
<table width="100%"><tr>
<td style="padding:10px;background:#f9fafb;border-radius:6px;text-align:center;"><b style="font-size:22px;">${p.total ?? 0}</b><br><small>Total</small></td>
<td width="10"></td>
<td style="padding:10px;background:#fef3c7;border-radius:6px;text-align:center;"><b>${p.reels ?? 0}</b><br><small>Reels</small></td>
<td width="10"></td>
<td style="padding:10px;background:#dbeafe;border-radius:6px;text-align:center;"><b>${p.carousels ?? 0}</b><br><small>Carrossel</small></td>
<td width="10"></td>
<td style="padding:10px;background:#fce7f3;border-radius:6px;text-align:center;"><b>${p.images ?? 0}</b><br><small>Imagem</small></td>
</tr></table>
<h2 style="margin:24px 0 16px;color:#333;">Engajamento</h2>
<p style="margin:0;color:#555;">❤️ ${e.total_likes ?? 0} curtidas &nbsp;•&nbsp; 💬 ${e.total_comments ?? 0} comentários<br>
Total: <b>${e.total ?? 0}</b> &nbsp;•&nbsp; Média por post: <b>${e.avg_per_post?.toFixed(0) ?? 0}</b></p>
<div style="margin:30px 0;text-align:center;">
<a href="${publicLink}" style="display:inline-block;padding:14px 28px;background:#833AB4;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">🔗 Ver relatório completo</a>
</div>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px;text-align:center;color:#999;font-size:12px;">Relatório gerado automaticamente</td></tr>
</table></body></html>`;
}

function buildWhatsAppText(profile: any, report: any, publicLink: string) {
  const d = report.data || {};
  const f = d.followers || {};
  const p = d.posts || {};
  const e = d.engagement || {};
  const sign = (n: number | null | undefined) =>
    n == null ? "—" : n > 0 ? `+${n}` : `${n}`;
  return `📊 *Relatório Social Media — ${report.month}*
👤 *${profile.display_name || profile.username}* (@${profile.username})

*Seguidores*
• Atual: ${f.end ?? "—"}
• Saldo do mês: ${sign(f.gain)}
• Crescimento: ${f.pct_growth != null ? f.pct_growth.toFixed(1) + "%" : "—"}

*Posts publicados:* ${p.total ?? 0}
• Reels: ${p.reels ?? 0}
• Carrossel: ${p.carousels ?? 0}
• Imagem: ${p.images ?? 0}

*Engajamento*
❤️ ${e.total_likes ?? 0} curtidas
💬 ${e.total_comments ?? 0} comentários
📈 Total: ${e.total ?? 0} | Média/post: ${e.avg_per_post?.toFixed(0) ?? 0}

🔗 Relatório completo:
${publicLink}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    const isCron = req.headers.get("x-cron-call") === "1";
    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (!claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", claims.claims.sub).eq("role", "admin").maybeSingle();
      if (!role) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    const body = await req.json();
    const reportId: string = body.report_id;
    const sendWhats = body.send_whatsapp !== false;
    const sendEmailFlag = body.send_email !== false;

    const { data: report } = await admin
      .from("social_media_monthly_reports")
      .select("*")
      .eq("id", reportId)
      .single();
    if (!report) throw new Error("Relatório não encontrado");

    const { data: profile } = await admin
      .from("social_media_client_profiles")
      .select("*")
      .eq("id", report.profile_id)
      .single();
    if (!profile) throw new Error("Perfil não encontrado");

    const { data: config } = await admin.from("social_media_report_config").select("*").limit(1).maybeSingle();

    const siteUrl = body.site_url || Deno.env.get("PUBLIC_SITE_URL") || "https://atendimento-astros-acd.lovable.app";
    const publicLink = `${siteUrl}/r/social/${report.share_token}`;

    const result: any = { whatsapp: null, email: null };

    // ===== WhatsApp =====
    if (sendWhats && profile.notify_whatsapp && profile.whatsapp_number) {
      try {
        // 1) tenta config global → 2) tenta billing_whatsapp_instances ativa
        let apiUrl: string | undefined;
        let apiKey: string | undefined;
        let instanceName: string | undefined;

        if (config?.evolution_instance_id) {
          const { data: inst } = await admin
            .from("billing_whatsapp_instances")
            .select("*")
            .eq("id", config.evolution_instance_id)
            .maybeSingle();
          if (inst) {
            apiUrl = inst.api_url;
            apiKey = inst.api_key;
            instanceName = inst.instance_name;
          }
        }
        if (!apiUrl) {
          const { data: inst } = await admin
            .from("billing_whatsapp_instances")
            .select("*")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          if (inst) {
            apiUrl = inst.api_url;
            apiKey = inst.api_key;
            instanceName = inst.instance_name;
          }
        }
        if (!apiUrl || !apiKey || !instanceName) {
          throw new Error("Nenhuma instância Evolution API configurada");
        }
        await sendWhatsApp(apiUrl, apiKey, instanceName, profile.whatsapp_number, buildWhatsAppText(profile, report, publicLink));
        await admin
          .from("social_media_monthly_reports")
          .update({ sent_whatsapp_at: new Date().toISOString(), send_whatsapp_error: null })
          .eq("id", reportId);
        result.whatsapp = { success: true };
      } catch (e: any) {
        await admin
          .from("social_media_monthly_reports")
          .update({ send_whatsapp_error: e.message?.slice(0, 500) })
          .eq("id", reportId);
        result.whatsapp = { success: false, error: e.message };
      }
    }

    // ===== Email =====
    if (sendEmailFlag && profile.notify_email && profile.email) {
      try {
        const host = config?.email_smtp_host || "smtp.gmail.com";
        const port = config?.email_smtp_port || 465;
        const user = config?.email_smtp_user;
        const pass = config?.email_smtp_pass;
        const from = config?.email_from || user;
        if (!user || !pass || !from) throw new Error("Email não configurado (user/pass/from)");
        await sendEmail(
          { host, port, user, pass, from, fromName: config?.email_from_name },
          profile.email,
          `📊 Seu relatório de ${report.month} — @${profile.username}`,
          buildReportHTML(profile, report, publicLink),
        );
        await admin
          .from("social_media_monthly_reports")
          .update({ sent_email_at: new Date().toISOString(), send_email_error: null })
          .eq("id", reportId);
        result.email = { success: true };
      } catch (e: any) {
        await admin
          .from("social_media_monthly_reports")
          .update({ send_email_error: e.message?.slice(0, 500) })
          .eq("id", reportId);
        result.email = { success: false, error: e.message };
      }
    }

    return new Response(JSON.stringify({ ...result, public_link: publicLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("social-media-send-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
