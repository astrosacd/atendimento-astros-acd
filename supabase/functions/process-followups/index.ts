import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Fetch pending followups that are due
    const { data: followups, error: fetchError } = await supabase
      .from("client_followups")
      .select("*, clientes(*)")
      .eq("status", "pending")
      .lte("next_dispatch_at", now)
      .order("next_dispatch_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("❌ Error fetching followups:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!followups || followups.length === 0) {
      console.log("ℹ️ No pending followups to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📋 Processing ${followups.length} followups`);

    // Fetch send config for email/whatsapp credentials
    const { data: config } = await supabase
      .from("proposal_send_config")
      .select("*")
      .limit(1)
      .single();

    let processed = 0;
    let errors = 0;

    for (const followup of followups) {
      try {
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

        const message =
          followup.custom_message ||
          followup.message_template ||
          `Olá ${clientName}, temos uma oferta especial para você sobre ${followup.produto}. Entre em contato conosco!`;

        const channel = followup.channel;
        let emailSent = false;
        let whatsappSent = false;

        // Send Email
        if (
          (channel === "email" || channel === "both") &&
          clientEmail &&
          config?.email_enabled &&
          config?.gmail_user &&
          config?.gmail_app_password
        ) {
          try {
            const htmlBody = generateEmailHtml(clientName, followup.produto, message, config.gmail_sender_name || "Equipe Comercial");

            const client = new SMTPClient({
              connection: {
                hostname: "smtp.gmail.com",
                port: 465,
                tls: true,
                auth: {
                  username: config.gmail_user,
                  password: config.gmail_app_password,
                },
              },
            });

            const fromAddress = config.gmail_sender_name
              ? `${config.gmail_sender_name} <${config.gmail_user}>`
              : config.gmail_user;

            await client.send({
              from: fromAddress,
              to: clientEmail,
              subject: `Oferta especial: ${followup.produto}`,
              content: message,
              html: htmlBody,
            });

            await client.close();
            emailSent = true;
            console.log(`✅ Email sent to ${clientEmail} for followup ${followup.id}`);

            await supabase.from("client_followup_logs").insert({
              followup_id: followup.id,
              channel: "email",
              status: "sent",
            });
          } catch (err: any) {
            console.error(`❌ Email error for followup ${followup.id}:`, err.message);
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
          config?.evolution_api_url &&
          config?.evolution_api_key &&
          config?.evolution_instance_name
        ) {
          try {
            let cleanNumber = clientPhone.replace(/\D/g, "");
            if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
              cleanNumber = "55" + cleanNumber;
            }

            const url = `${config.evolution_api_url}/message/sendText/${config.evolution_instance_name}`;

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: config.evolution_api_key,
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
            console.log(`✅ WhatsApp sent to ${cleanNumber} for followup ${followup.id}`);

            await supabase.from("client_followup_logs").insert({
              followup_id: followup.id,
              channel: "whatsapp",
              status: "sent",
            });
          } catch (err: any) {
            console.error(`❌ WhatsApp error for followup ${followup.id}:`, err.message);
            await supabase.from("client_followup_logs").insert({
              followup_id: followup.id,
              channel: "whatsapp",
              status: "error",
              error_message: err.message,
            });
          }
        }

        const newAttempt = followup.current_attempt + 1;
        const anySent = emailSent || whatsappSent;

        if (!anySent) {
          // Nothing sent - mark as failed
          await supabase
            .from("client_followups")
            .update({
              status: "failed",
              current_attempt: newAttempt,
            })
            .eq("id", followup.id);
          errors++;
        } else if (
          followup.is_recurring &&
          newAttempt < followup.max_attempts
        ) {
          // Recurring and still has attempts - schedule next
          const nextDate = new Date();
          nextDate.setDate(
            nextDate.getDate() + (followup.recurrence_interval_days || 3)
          );

          await supabase
            .from("client_followups")
            .update({
              current_attempt: newAttempt,
              next_dispatch_at: nextDate.toISOString(),
              status: "pending",
            })
            .eq("id", followup.id);
          processed++;
        } else {
          // Single dispatch or max attempts reached - mark as completed
          await supabase
            .from("client_followups")
            .update({
              current_attempt: newAttempt,
              status: followup.is_recurring ? "completed" : "sent",
            })
            .eq("id", followup.id);
          processed++;
        }
      } catch (err: any) {
        console.error(`❌ Error processing followup ${followup.id}:`, err.message);
        errors++;
      }
    }

    console.log(`✅ Processed: ${processed}, Errors: ${errors}`);
    return new Response(
      JSON.stringify({ processed, errors, total: followups.length }),
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

function generateEmailHtml(
  clientName: string,
  produto: string,
  message: string,
  senderName: string
): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Follow-up</title></head><body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);padding:40px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">Follow-up Comercial</h1></td></tr><tr><td style="padding:40px;"><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Ola <strong>${clientName}</strong>,</p><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">${message}</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:30px 0;"><tr><td style="background-color:#f8fafc;border-radius:8px;padding:24px;border-left:4px solid #8b5cf6;"><p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">PRODUTO</p><p style="color:#1e293b;font-size:20px;font-weight:600;margin:0;">${produto}</p></td></tr></table></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;">Atenciosamente,</p><p style="color:#374151;font-size:16px;font-weight:600;margin:0;">${senderName}</p></td></tr></table></td></tr></table></body></html>`;
}
