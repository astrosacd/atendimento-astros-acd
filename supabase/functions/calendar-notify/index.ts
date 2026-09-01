import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

// Remove acentos e caracteres nao-ASCII dos headers de email para evitar
// que o assunto apareca codificado (=?utf-8?Q?...) no cliente de email.
function toAsciiHeader(input: string): string {
  try {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  } catch {
    return input.replace(/[^\x20-\x7E]/g, '');
  }
}

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
    const wantsWhatsApp = channel === "whatsapp" || channel === "both";
    const wantsEmail = channel === "email" || channel === "both";
    const template = config.notify_message_template || 
      "Olá {client_name} 👋\n\nPassando para lembrar da nossa reunião:\n🗓️ {date} às {time}\n\n🔗 {meet_link}";

    // Get date range in Brasilia time for physical meetings
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(now);
    const startOfToday = new Date(`${todayStr}T00:00:00.000-03:00`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999-03:00`);

    // Determine current Brasilia hour - physical reminders only fire from 08:00 onwards
    const brasiliaHourFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    });
    const currentBrasiliaHour = parseInt(brasiliaHourFmt.format(now), 10);
    const PHYSICAL_START_HOUR = 8;
    const physicalAllowed = currentBrasiliaHour >= PHYSICAL_START_HOUR;
    console.log(`[calendar-notify] Brasilia hour=${currentBrasiliaHour}, physicalAllowed=${physicalAllowed}`);

    // Delay helper to avoid WhatsApp blocks (3s between blocks)
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const BLOCK_DELAY_MS = 3000;

    // Target window for online meetings
    const targetTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

    console.log(`[calendar-notify] Checking online window: ${now.toISOString()} - ${windowEnd.toISOString()}`);
    console.log(`[calendar-notify] Checking physical window: ${startOfToday.toISOString()} - ${endOfToday.toISOString()}`);

    // Find events that haven't been notified
    // We fetch a bit more and filter in JS to handle both types
    const { data: allEvents, error: eventsError } = await supabase
      .from("calendar_events")
      .select("*")
      .in("status", ["scheduled", "confirmed"])
      .eq("source", "local")
      .is("notified_at", null)
      .gte("start_time", startOfToday.toISOString()) // At least starting today
      .lte("start_time", endOfToday.toISOString().replace(/\d{4}$/, "9999")); // Or further if needed, but today is enough for physical

    if (eventsError) throw eventsError;

    // Filter events based on their type and window
    const events = (allEvents || []).filter(event => {
      const startTime = new Date(event.start_time);
      
      if (event.meeting_type === 'physical') {
        // Physical meetings are notified anytime today, but ONLY after 08:00 Brasilia
        if (!physicalAllowed) return false;
        return startTime >= startOfToday && startTime <= endOfToday;
      } else {
        // Online (default) are notified 1h before
        return startTime >= now && startTime <= windowEnd;
      }
    });

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

      // Choose template based on meeting type
      let message = template;
      if (event.meeting_type === 'physical') {
        message = "Olá {client_name} 👋\n\nPassando para lembrar que hoje você receberá uma visita do(a) consultor(a) da Astros para a reunião agendada às {time}.";
        if (event.location) {
          message += `\n\n📍 Local: ${event.location}`;
        }
      }

      // Replace template variables
      message = message
        .replace(/{client_name}/g, event.client_name || "Cliente")
        .replace(/{date}/g, dateStr)
        .replace(/{time}/g, timeStr)
        .replace(/{meet_link}/g, event.meet_link || "")
        .replace(/{title}/g, event.title || "");

      try {
        let clientWhatsAppSatisfied = !wantsWhatsApp;
        let clientEmailSatisfied = !wantsEmail;

        // Send WhatsApp to client
        if (wantsWhatsApp && event.client_phone) {
          const phone = event.client_phone.replace(/\D/g, "");
          if (!hasWhatsApp) {
            errors++;
            await supabase.from("calendar_notification_logs").insert({
              event_id: event.id,
              channel: "whatsapp",
              recipient_type: "client",
              recipient_name: event.client_name,
              recipient_contact: phone,
              message_sent: message,
              status: "error",
              error_message: "Nenhuma instância ativa de WhatsApp foi configurada para a Agenda.",
            });
          } else {
            let clientWhatsAppSent = false;

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
                  clientWhatsAppSent = true;
                  clientWhatsAppSatisfied = true;

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

            if (!clientWhatsAppSent) {
              errors++;
              await supabase.from("calendar_notification_logs").insert({
                event_id: event.id,
                channel: "whatsapp",
                recipient_type: "client",
                recipient_name: event.client_name,
                recipient_contact: phone,
                message_sent: message,
                status: "error",
                error_message: "Não foi possível enviar o lembrete por WhatsApp em nenhuma instância ativa.",
              });
            }
          }
        }

        // Delay between client block and consultant block to avoid WhatsApp throttling
        await sleep(BLOCK_DELAY_MS);

        // Send WhatsApp to consultants
        // IMPORTANT: For PHYSICAL meetings, the consultant receives a single grouped daily summary
        // via the `calendar-physical-summary` function. To avoid duplicate messages, we skip
        // individual consultant reminders here for physical events. Online meetings still notify
        // the consultant individually since there is no daily summary for them.
        const consultantPhones: string[] = event.consultant_phones || [];
        const isPhysical = event.meeting_type === 'physical';
        if (wantsWhatsApp && !isPhysical && consultantPhones.length > 0 && hasWhatsApp) {
          let consultantMessage = `📋 Lembrete de reunião ONLINE:\n\n📌 ${event.title}\n👤 Cliente: ${event.client_name || "N/A"}\n🗓️ ${dateStr} às ${timeStr}`;
          
          if (event.meet_link) {
            consultantMessage += `\n🔗 Link: ${event.meet_link}`;
          }

          // Internal notes (visible only to consultant)
          const cleanNotes = (event.notes || '')
            .split('\n')
            .filter((l: string) => !l.startsWith('[NOTIFICADO'))
            .join('\n')
            .trim();
          if (cleanNotes) {
            consultantMessage += `\n\n📝 *Observações internas:*\n${cleanNotes}`;
          }

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
            // Delay between consultant phones
            await sleep(BLOCK_DELAY_MS);
          }
        }

        // Send Email to client using SMTP
        if (wantsEmail && event.client_email) {
          const isPhysical = event.meeting_type === 'physical';
          const subject = toAsciiHeader(`Lembrete: ${isPhysical ? 'Visita Presencial' : 'Reuniao Online'} - ${event.title} - ${dateStr} as ${timeStr}`);
          const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;border-radius:10px 10px 0 0;text-align:center;"><h1 style="color:white;margin:0;">📅 Lembrete de ${isPhysical ? 'Visita' : 'Reunião'}</h1></div><div style="background:#f9fafb;padding:30px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;"><p style="font-size:16px;color:#374151;">Olá, <strong>${event.client_name || "Cliente"}</strong>!</p><p style="font-size:14px;color:#6b7280;">Passando para lembrar da sua ${isPhysical ? 'visita' : 'reunião'} agendada:</p><div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;"><p style="margin:5px 0;font-size:14px;"><strong>📌 Título:</strong> ${event.title}</p><p style="margin:5px 0;font-size:14px;"><strong>🗓️ Data:</strong> ${dateStr} às ${timeStr}</p>${isPhysical && event.location ? `<p style="margin:5px 0;font-size:14px;"><strong>📍 Local:</strong> ${event.location}</p>` : ""}${!isPhysical && event.meet_link ? `<p style="margin:5px 0;font-size:14px;"><strong>🔗 Link:</strong> <a href="${event.meet_link}" style="color:#667eea;">${event.meet_link}</a></p>` : ""}${event.description ? `<p style="margin:5px 0;font-size:14px;"><strong>📝 Descrição:</strong> ${event.description}</p>` : ""}</div>${!isPhysical && event.meet_link ? `<div style="text-align:center;margin:20px 0;"><a href="${event.meet_link}" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Clique aqui para entrar na reunião</a></div>` : ""}<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"><p style="font-size:11px;color:#9ca3af;text-align:center;">Sistema de Gerenciamento - Astros</p></div></body></html>`;

          if (!hasEmail) {
            errors++;
            await supabase.from("calendar_notification_logs").insert({
              event_id: event.id,
              channel: "email",
              recipient_type: "client",
              recipient_name: event.client_name,
              recipient_contact: event.client_email,
              message_sent: subject,
              status: "error",
              error_message: "As credenciais de e-mail da Agenda não estão configuradas.",
            });
          } else {
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
                from: `${toAsciiHeader('Agenda Astros')} <${notifyGmailUser}>`,
                to: event.client_email,
                subject,
                html: emailHtml,
              });

              await smtpClient.close();

              console.log(`[calendar-notify] Email sent to ${event.client_email} for event ${event.id}`);
              sent++;
              clientEmailSatisfied = true;

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
        }

        // Trigger Baserow lead creation (Client only)
        try {
          const baserowEvent = event.meeting_type === 'physical' ? 'agenda.presencial' : 'agenda.online';
          const cleanPhone = (event.client_phone || '').replace(/\D/g, '');
          if (cleanPhone) {
            console.log(`[calendar-notify] 📦 Triggering Baserow lead creation for event: ${baserowEvent}`);
            const baserowResp = await fetch(`${supabaseUrl}/functions/v1/baserow-create-lead`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                module: 'agenda',
                event: baserowEvent,
                lead_name: event.client_name || 'Cliente Agenda',
                lead_phone: cleanPhone,
                lead_date: dateStr,
                lead_produto: event.title || 'Reunião Agenda',
              }),
            });

            const baserowText = await baserowResp.text();
            if (!baserowResp.ok) {
              console.error(`[calendar-notify] ❌ Baserow error ${baserowResp.status}: ${baserowText}`);
            } else {
              console.log(`[calendar-notify] ✅ Baserow response (${baserowEvent}): ${baserowText}`);
            }
          }
        } catch (baserowErr: any) {
          console.error('[calendar-notify] ⚠️ Baserow lead creation failed (non-blocking):', baserowErr.message);
        }

        if (clientWhatsAppSatisfied && clientEmailSatisfied) {
          await supabase.from("calendar_events").update({
            notified_at: new Date().toISOString(),
          }).eq("id", event.id);
        } else {
          console.warn(`[calendar-notify] Event ${event.id} was not marked as notified because at least one required client channel failed.`);
        }

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

      // Delay between distinct events to spread out the load
      await sleep(BLOCK_DELAY_MS);
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