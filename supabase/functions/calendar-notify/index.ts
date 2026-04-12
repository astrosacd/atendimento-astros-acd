import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get notification config
    const { data: configRows } = await supabase.from("calendar_config").select("*");
    const config: Record<string, string> = {};
    (configRows || []).forEach((r: any) => { config[r.config_key] = r.config_value; });

    if (config.notify_client_enabled !== "true") {
      console.log("[calendar-notify] Notifications disabled");
      return new Response(JSON.stringify({ message: "Notifications disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoursBefore = parseInt(config.notify_hours_before || "1");
    const channel = config.notify_channel || "whatsapp";
    const template = config.notify_message_template || 
      "Olá {client_name} 👋\n\nPassando para lembrar da nossa reunião:\n🗓️ {date} às {time}\n\n🔗 {meet_link}";

    // Find events happening in the next X hours that haven't been notified
    const now = new Date();
    const targetTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from("calendar_events")
      .select("*")
      .in("status", ["scheduled", "confirmed"])
      .eq("source", "local") // ONLY notify for locally created events
      .is("notified_at", null) // Only events NOT yet notified
      .gte("start_time", now.toISOString())
      .lte("start_time", windowEnd.toISOString());

    if (eventsError) throw eventsError;

    if (!events?.length) {
      console.log("[calendar-notify] No upcoming local events to notify");
      return new Response(JSON.stringify({ message: "No events to notify", checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[calendar-notify] Found ${events.length} local events to check`);

    // Get independent notification config (Gmail + WhatsApp instances)
    const notifyGmailUser = config.notify_gmail_user || "";
    const notifyGmailPass = config.notify_gmail_password || "";

    // Get active WhatsApp instances for this module
    const { data: whatsappInstances } = await supabase
      .from("calendar_notification_whatsapp_instances")
      .select("*")
      .eq("is_active", true);

    const hasWhatsApp = whatsappInstances && whatsappInstances.length > 0;
    const hasEmail = !!(notifyGmailUser && notifyGmailPass);

    let sent = 0;
    let errors = 0;

    for (const event of events) {
      if (!event.client_phone && !event.client_email) {
        console.log(`[calendar-notify] Skipping event ${event.id} - no contact info`);
        continue;
      }

      const startDate = new Date(event.start_time);
      const dateStr = startDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const timeStr = startDate.toLocaleTimeString("pt-BR", { 
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" 
      });

      // Replace template variables
      const message = template
        .replace(/{client_name}/g, event.client_name || "Cliente")
        .replace(/{date}/g, dateStr)
        .replace(/{time}/g, timeStr)
        .replace(/{meet_link}/g, event.meet_link || "")
        .replace(/{title}/g, event.title || "");

      try {
        // Send WhatsApp to client
        if ((channel === "whatsapp" || channel === "both") && event.client_phone && hasWhatsApp) {
          const phone = event.client_phone.replace(/\D/g, "");
          
          for (const instance of whatsappInstances!) {
            try {
              const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
              const res = await fetch(sendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: instance.api_key },
                body: JSON.stringify({ number: phone, text: message }),
              });

              if (res.ok) {
                console.log(`[calendar-notify] WhatsApp sent via ${instance.instance_name} for event ${event.id}`);
                sent++;

                await supabase.from("calendar_notification_logs").insert({
                  event_id: event.id,
                  channel: "whatsapp",
                  recipient_type: "client",
                  recipient_name: event.client_name,
                  recipient_contact: phone,
                  message_sent: message,
                  status: "sent",
                  whatsapp_instance_id: instance.id,
                });

                await supabase.from("calendar_notification_whatsapp_instances")
                  .update({ last_used_at: new Date().toISOString() })
                  .eq("id", instance.id);

                break;
              } else {
                const errorText = await res.text();
                console.error(`[calendar-notify] WhatsApp error via ${instance.instance_name}:`, errorText);
              }
            } catch (instErr: any) {
              console.error(`[calendar-notify] Instance ${instance.instance_name} error:`, instErr.message);
            }
          }
        }

        // Send WhatsApp to consultants
        const consultantPhones: string[] = event.consultant_phones || [];
        if ((channel === "whatsapp" || channel === "both") && consultantPhones.length > 0 && hasWhatsApp) {
          const consultantMessage = `📋 Lembrete de reunião:\n\n📌 ${event.title}\n👤 Cliente: ${event.client_name || "N/A"}\n🗓️ ${dateStr} às ${timeStr}\n${event.meet_link ? `🔗 ${event.meet_link}` : ""}`;
          
          for (const consultantPhone of consultantPhones) {
            const phone = consultantPhone.replace(/\D/g, "");
            if (!phone) continue;

            for (const instance of whatsappInstances!) {
              try {
                const sendUrl = `${instance.api_url}/message/sendText/${instance.instance_name}`;
                const res = await fetch(sendUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: instance.api_key },
                  body: JSON.stringify({ number: phone, text: consultantMessage }),
                });

                if (res.ok) {
                  console.log(`[calendar-notify] Consultant WhatsApp sent to ${phone}`);
                  await supabase.from("calendar_notification_logs").insert({
                    event_id: event.id,
                    channel: "whatsapp",
                    recipient_type: "consultant",
                    recipient_contact: phone,
                    message_sent: consultantMessage,
                    status: "sent",
                    whatsapp_instance_id: instance.id,
                  });
                  break;
                }
              } catch (e: any) {
                console.error(`[calendar-notify] Consultant send error:`, e.message);
              }
            }
          }
        }

        // Send Email to client using SMTP
        if ((channel === "email" || channel === "both") && event.client_email && hasEmail) {
          const subject = `Lembrete: ${event.title} - ${dateStr} às ${timeStr}`;
          const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0;">📅 Lembrete de Reunião</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
    <p style="font-size: 16px; color: #374151;">Olá, <strong>${event.client_name || "Cliente"}</strong>!</p>
    <p style="font-size: 14px; color: #6b7280;">Passando para lembrar da nossa reunião:</p>
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 5px 0; font-size: 14px;"><strong>📌 Título:</strong> ${event.title}</p>
      <p style="margin: 5px 0; font-size: 14px;"><strong>🗓️ Data:</strong> ${dateStr} às ${timeStr}</p>
      ${event.meet_link ? `<p style="margin: 5px 0; font-size: 14px;"><strong>🔗 Link:</strong> <a href="${event.meet_link}" style="color: #667eea;">${event.meet_link}</a></p>` : ""}
      ${event.description ? `<p style="margin: 5px 0; font-size: 14px;"><strong>📝 Descrição:</strong> ${event.description}</p>` : ""}
    </div>
    ${event.meet_link ? `<div style="text-align: center; margin: 20px 0;">
      <a href="${event.meet_link}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Entrar na Reunião</a>
    </div>` : ""}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 11px; color: #9ca3af; text-align: center;">Sistema de Gerenciamento - Astros</p>
  </div>
</body>
</html>`.trim();

          try {
            const smtpClient = new SMTPClient({
              connection: {
                hostname: "smtp.gmail.com",
                port: 465,
                tls: true,
                auth: {
                  username: notifyGmailUser,
                  password: notifyGmailPass,
                },
              },
            });

            await smtpClient.send({
              from: notifyGmailUser,
              to: event.client_email,
              subject: subject,
              content: message,
              html: emailHtml,
            });

            await smtpClient.close();

            console.log(`[calendar-notify] Email sent to ${event.client_email} for event ${event.id}`);
            sent++;

            await supabase.from("calendar_notification_logs").insert({
              event_id: event.id,
              channel: "email",
              recipient_type: "client",
              recipient_name: event.client_name,
              recipient_contact: event.client_email,
              message_sent: subject,
              status: "sent",
            });
          } catch (emailErr: any) {
            console.error(`[calendar-notify] Email error for event ${event.id}:`, emailErr.message);
            errors++;
            await supabase.from("calendar_notification_logs").insert({
              event_id: event.id,
              channel: "email",
              recipient_type: "client",
              recipient_name: event.client_name,
              recipient_contact: event.client_email,
              message_sent: subject,
              status: "error",
              error_message: emailErr.message,
            });
          }
        }

        // Mark as notified with timestamp
        await supabase.from("calendar_events").update({
          notified_at: new Date().toISOString(),
        }).eq("id", event.id);

      } catch (err: any) {
        console.error(`[calendar-notify] Error for event ${event.id}:`, err.message);
        errors++;
        
        await supabase.from("calendar_notification_logs").insert({
          event_id: event.id,
          channel: channel,
          recipient_type: "client",
          recipient_name: event.client_name,
          recipient_contact: event.client_phone || event.client_email,
          message_sent: message,
          status: "error",
          error_message: err.message,
        });
      }
    }

    console.log(`[calendar-notify] Done: ${sent} sent, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      sent,
      errors,
      checked: events.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[calendar-notify] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});