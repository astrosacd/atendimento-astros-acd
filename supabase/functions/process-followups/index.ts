import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();
    const body = await req.json().catch(() => ({}));
    const targetFollowupId = typeof body?.followup_id === "string" ? body.followup_id : null;

    // Fetch active webhooks
    const { data: webhooks } = await supabase
      .from("followup_webhooks")
      .select("*")
      .eq("is_active", true);

    // Pick a specific follow-up when manually retrying, otherwise process the queue one at a time.
    let followupsQuery = supabase
      .from("client_followups")
      .select("*, clientes(*)")
      .eq("status", "pending")
      .lte("next_dispatch_at", now)
      .order("next_dispatch_at", { ascending: true })
      .limit(1);

    if (targetFollowupId) {
      followupsQuery = followupsQuery.eq("id", targetFollowupId);
    }

    const { data: followups, error: fetchError } = await followupsQuery;

    if (fetchError) {
      console.error("❌ Error fetching followups:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!followups || followups.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "Nenhum followup pendente na fila" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const followup = followups[0];
    console.log(`📨 Processando followup da fila: ${followup.id}`);

    // Fetch send config for email/whatsapp credentials
    const { data: config } = await supabase
      .from("proposal_send_config")
      .select("*")
      .limit(1)
      .single();

    const clientName =
      followup.manual_name ||
      (followup.clientes as any)?.nome ||
      "Cliente";
    const clientEmail =
      followup.manual_email ||
      (followup.clientes as any)?.email;
    const clientPhone =
      followup.manual_phone ||
      (followup.clientes as any)?.numero;

    const envioTipo: "proposta" | "contrato" | "distrato" = followup.envio_tipo || "proposta";
    const isDocumento = envioTipo === "contrato" || envioTipo === "distrato";
    const tipoLabel = envioTipo === "contrato" ? "Contrato" : envioTipo === "distrato" ? "Distrato" : "Proposta";

    const defaultMessage = isDocumento
      ? `Olá ${clientName}, segue o ${tipoLabel.toLowerCase()} referente a ${followup.produto} para sua assinatura.`
      : `Olá ${clientName}, temos uma oferta especial para você sobre ${followup.produto}. Entre em contato conosco!`;

    const baseMessage =
      followup.custom_message ||
      followup.message_template ||
      defaultMessage;

    // Signed URL do PDF (válida por 7 dias) — bucket privado "contratos"
    let pdfSignedUrl: string | null = null;
    let pdfBase64: string | null = null;
    const pdfFileName = followup.doc_pdf_name || `${tipoLabel.toLowerCase()}.pdf`;

    if (isDocumento && followup.doc_pdf_url) {
      try {
        const { data: signed } = await supabase.storage
          .from("contratos")
          .createSignedUrl(followup.doc_pdf_url, 60 * 60 * 24 * 7);
        pdfSignedUrl = signed?.signedUrl || null;

        const { data: fileData, error: dlError } = await supabase.storage
          .from("contratos")
          .download(followup.doc_pdf_url);
        if (dlError) throw dlError;
        if (fileData) {
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          pdfBase64 = btoa(binary);
        }
      } catch (err: any) {
        console.error("❌ Erro ao preparar PDF:", err.message);
        await supabase.from("client_followup_logs").insert({
          followup_id: followup.id,
          channel: "system",
          status: "error",
          error_message: `Falha ao carregar PDF do ${tipoLabel.toLowerCase()}: ${err.message}`,
        });
      }
    }

    // Mensagem final (texto) com bloco de documento quando aplicável
    let message = baseMessage;
    if (isDocumento) {
      const parts: string[] = [baseMessage];
      if (followup.doc_link) {
        parts.push(`\n📝 *Assine o ${tipoLabel.toLowerCase()} online:*\n${followup.doc_link}`);
      }
      if (pdfSignedUrl && !pdfBase64) {
        parts.push(`\n📎 *Baixar o PDF:*\n${pdfSignedUrl}`);
      }
      message = parts.join("\n");
    }

    const channel = followup.channel;
    let emailSent = false;
    let whatsappSent = false;
    const gmailUser = Deno.env.get("GMAIL_USER") || config?.gmail_user;
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD") || config?.gmail_app_password;
    const evolutionApiUrl = (Deno.env.get("EVOLUTION_API_URL") || config?.evolution_api_url || "").replace(/\/$/, "");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY") || config?.evolution_api_key;
    const evolutionInstanceName = Deno.env.get("EVOLUTION_INSTANCE") || config?.evolution_instance_name;

    // Send Email
    if (
      (channel === "email" || channel === "both") &&
      clientEmail &&
      config?.email_enabled &&
      gmailUser &&
      gmailAppPassword
    ) {
      try {
        const htmlBody = generateEmailHtml(
          clientName,
          followup.produto,
          baseMessage,
          config.gmail_sender_name || "Equipe Comercial",
          {
            tipo: envioTipo,
            tipoLabel,
            docLink: followup.doc_link || null,
            pdfUrl: pdfSignedUrl,
            pdfName: pdfFileName,
          }
        );

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

        const fromAddress = config.gmail_sender_name
          ? `${config.gmail_sender_name} <${gmailUser}>`
          : gmailUser;

        const subject = isDocumento
          ? `${tipoLabel} para assinatura - ${followup.produto}`
          : `${clientName}, temos uma novidade para você! 🚀`;

        await client.send({
          from: fromAddress,
          to: clientEmail,
          subject,
          content: message,
          html: htmlBody,
          ...(pdfBase64
            ? {
                attachments: [
                  {
                    filename: pdfFileName,
                    content: pdfBase64,
                    encoding: "base64" as const,
                    contentType: "application/pdf",
                  },
                ],
              }
            : {}),
        });

        await client.close();
        emailSent = true;
        console.log(`✅ Email enviado para ${clientEmail}`);

        await supabase.from("client_followup_logs").insert({
          followup_id: followup.id,
          channel: "email",
          status: "sent",
        });
      } catch (err: any) {
        console.error(`❌ Erro email:`, err.message);
        await supabase.from("client_followup_logs").insert({
          followup_id: followup.id,
          channel: "email",
          status: "error",
          error_message: err.message,
        });
      }
    }

    // Send WhatsApp
    if (
      (channel === "whatsapp" || channel === "both") &&
      clientPhone &&
      config?.whatsapp_enabled &&
      evolutionApiUrl &&
      evolutionApiKey &&
      evolutionInstanceName
    ) {
      try {
        const rawPhone = clientPhone.trim();
        // Remove non-digit characters; the phone input component
        // already stores the full number with DDI (e.g. 51944853866 for Peru)
        const cleanNumber = rawPhone.replace(/\D/g, "");

        const url = `${evolutionApiUrl}/message/sendText/${evolutionInstanceName}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionApiKey,
          },
          body: JSON.stringify({
            number: cleanNumber,
            text: message,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        whatsappSent = true;
        console.log(`✅ WhatsApp enviado para ${cleanNumber}`);

        // Envia o PDF como documento quando houver
        if (isDocumento && pdfSignedUrl) {
          try {
            const mediaResp = await fetch(`${evolutionApiUrl}/message/sendMedia/${evolutionInstanceName}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: evolutionApiKey,
              },
              body: JSON.stringify({
                number: cleanNumber,
                mediatype: "document",
                mimetype: "application/pdf",
                media: pdfSignedUrl,
                fileName: pdfFileName,
                caption: `${tipoLabel} - ${followup.produto}`,
              }),
            });
            if (!mediaResp.ok) {
              const t = await mediaResp.text();
              throw new Error(`HTTP ${mediaResp.status}: ${t}`);
            }
            console.log(`✅ PDF (${tipoLabel}) enviado via WhatsApp`);
          } catch (mediaErr: any) {
            console.error("❌ Erro ao enviar PDF no WhatsApp:", mediaErr.message);
            await supabase.from("client_followup_logs").insert({
              followup_id: followup.id,
              channel: "whatsapp",
              status: "error",
              error_message: `Texto enviado, mas falhou o envio do PDF: ${mediaErr.message}`,
            });
          }
        }

        await supabase.from("client_followup_logs").insert({
          followup_id: followup.id,
          channel: "whatsapp",
          status: "sent",
        });
      } catch (err: any) {
        console.error(`❌ Erro WhatsApp:`, err.message);
        await supabase.from("client_followup_logs").insert({
          followup_id: followup.id,
          channel: "whatsapp",
          status: "error",
          error_message: err.message,
        });
      }
    }

    // Update followup status
    const newAttempt = followup.current_attempt + 1;
    const anySent = emailSent || whatsappSent;

    if (!anySent) {
      await supabase
        .from("client_followups")
        .update({ status: "failed", current_attempt: newAttempt })
        .eq("id", followup.id);

      await fireWebhooks(supabase, webhooks || [], "followup.failed", followup, clientName);
      await createBaserowLead(supabaseUrl, "followup.failed", clientName, clientPhone);

      const { data: latestErrors } = await supabase
        .from("client_followup_logs")
        .select("channel, error_message")
        .eq("followup_id", followup.id)
        .eq("status", "error")
        .order("sent_at", { ascending: false })
        .limit(2);

      const errorDetails = (latestErrors || [])
        .map((log: any) => `${log.channel}: ${log.error_message || "falha sem detalhe"}`)
        .join(" | ");

      return new Response(
        JSON.stringify({
          processed: 1,
          followup_id: followup.id,
          email_sent: false,
          whatsapp_sent: false,
          error: errorDetails || "Nenhum canal confirmou o envio",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (
      followup.is_recurring &&
      newAttempt < followup.max_attempts
    ) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + (followup.recurrence_interval_days || 3));

      await supabase
        .from("client_followups")
        .update({
          current_attempt: newAttempt,
          next_dispatch_at: nextDate.toISOString(),
          status: "pending",
        })
        .eq("id", followup.id);

      await fireWebhooks(supabase, webhooks || [], "followup.sent", followup, clientName);
      await createBaserowLead(supabaseUrl, "followup.sent", clientName, clientPhone);
    } else {
      await supabase
        .from("client_followups")
        .update({
          current_attempt: newAttempt,
          status: followup.is_recurring ? "completed" : "sent",
        })
        .eq("id", followup.id);

      await fireWebhooks(supabase, webhooks || [], "followup.sent", followup, clientName);
      await createBaserowLead(supabaseUrl, "followup.sent", clientName, clientPhone);
    }

    // Count remaining pending for this run
    const { count } = await supabase
      .from("client_followups")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("next_dispatch_at", now);

    console.log(`✅ Followup ${followup.id} processado. Restantes na fila: ${count || 0}`);

    return new Response(
      JSON.stringify({ 
        processed: 1, 
        followup_id: followup.id,
        remaining: count || 0,
        email_sent: emailSent,
        whatsapp_sent: whatsappSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("❌ Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fireWebhooks(
  supabase: any,
  webhooks: any[],
  evento: string,
  followup: any,
  clientName: string
) {
  if (!webhooks || webhooks.length === 0) return;

  const relevantWebhooks = webhooks.filter(
    (w: any) => w.eventos && w.eventos.includes(evento)
  );

  for (const webhook of relevantWebhooks) {
    const payload = {
      event: evento,
      timestamp: new Date().toISOString(),
      data: {
        followup_id: followup.id,
        cliente_name: clientName,
        cliente_email: followup.manual_email || followup.clientes?.email || null,
        cliente_phone: followup.manual_phone || followup.clientes?.numero || null,
        produto: followup.produto,
        channel: followup.channel,
        current_attempt: followup.current_attempt + 1,
        max_attempts: followup.max_attempts,
        is_recurring: followup.is_recurring,
        status: evento === "followup.sent" ? "sent" : "failed",
      },
    };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (webhook.secret_key) {
        headers["X-Webhook-Secret"] = webhook.secret_key;
      }

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text().catch(() => "");

      await supabase.from("followup_webhook_logs").insert({
        webhook_id: webhook.id,
        followup_id: followup.id,
        evento,
        payload,
        response_status: response.status,
        response_body: responseBody.substring(0, 1000),
        success: response.ok,
      });

      await supabase
        .from("followup_webhooks")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", webhook.id);

      console.log(`🔔 Webhook ${webhook.nome} fired for ${evento}`);
    } catch (err: any) {
      console.error(`❌ Webhook ${webhook.nome} error:`, err.message);
      await supabase.from("followup_webhook_logs").insert({
        webhook_id: webhook.id,
        followup_id: followup.id,
        evento,
        payload,
        response_status: null,
        response_body: err.message,
        success: false,
      });
    }
  }
}

async function createBaserowLead(
  supabaseUrl: string,
  event: string,
  clientName: string,
  clientPhone: string | null,
) {
  if (!clientPhone) return;

  try {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || '';
    const resp = await fetch(`${supabaseUrl}/functions/v1/baserow-create-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        module: 'followups',
        event,
        lead_name: clientName,
        lead_phone: clientPhone,
        lead_date: new Date().toLocaleDateString('pt-BR'),
      }),
    });

    const resultText = await resp.text();
    let parsed: any = null;

    try {
      parsed = JSON.parse(resultText);
    } catch {
      // keep raw text only
    }

    if (!resp.ok) {
      console.error(`❌ Baserow lead creation HTTP error (followups/${event}): ${resp.status} - ${resultText}`);
      return;
    }

    const allFailed = Array.isArray(parsed?.results)
      ? parsed.results.length > 0 && parsed.results.every((r: any) => r?.success === false)
      : false;

    if (parsed?.success === false || allFailed) {
      console.error(`❌ Baserow lead creation failed (followups/${event}): ${resultText}`);
      return;
    }

    if (parsed?.partial_failure) {
      console.warn(`⚠️ Baserow lead creation partial failure (followups/${event}): ${resultText}`);
    } else {
      console.log(`📦 Baserow lead creation (followups/${event}): ${resp.status} - ${resultText}`);
    }
  } catch (err: any) {
    console.error(`❌ Baserow lead creation error:`, err.message);
  }
}

function generateEmailHtml(
  clientName: string,
  produto: string,
  message: string,
  senderName: string
): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Novidade para você</title></head><body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);padding:40px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">Temos uma novidade para você! 🚀</h1></td></tr><tr><td style="padding:40px;"><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Olá <strong>${clientName}</strong>,</p><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;white-space:pre-wrap;">${message.replace(/\n/g, '<br>')}</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:30px 0;"><tr><td style="background-color:#f8fafc;border-radius:8px;padding:24px;border-left:4px solid #8b5cf6;"><p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">PRODUTO</p><p style="color:#1e293b;font-size:20px;font-weight:600;margin:0;">${produto}</p></td></tr></table></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;">Atenciosamente,</p><p style="color:#374151;font-size:16px;font-weight:600;margin:0;">${senderName}</p></td></tr></table></td></tr></table></body></html>`;
}
