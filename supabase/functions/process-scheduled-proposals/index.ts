import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

function toAsciiHeader(input: string): string {
  try {
    return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');
  } catch { return input.replace(/[^\x20-\x7E]/g, ''); }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("⏰ Processing scheduled proposal sends...");

    const { data: pendingSends, error: fetchError } = await supabase
      .from("proposal_scheduled_sends")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (fetchError) throw fetchError;

    if (!pendingSends || pendingSends.length === 0) {
      console.log("✅ No pending scheduled sends");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📋 Found ${pendingSends.length} scheduled send(s)`);

    // Fetch send config once
    const { data: config } = await supabase
      .from("proposal_send_config")
      .select("*")
      .limit(1)
      .single();

    if (!config) {
      console.error("❌ No send config found");
      return new Response(JSON.stringify({ error: "Config not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let errors = 0;

    for (const scheduled of pendingSends) {
      try {
        // Fetch proposal
        const { data: proposal } = await supabase
          .from("proposals")
          .select("*, clientes(*)")
          .eq("id", scheduled.proposal_id)
          .single();

        if (!proposal) {
          throw new Error("Proposta não encontrada");
        }

        const clientName = scheduled.recipient_name || proposal.manual_client_name || proposal.clientes?.nome || "Cliente";
        const clientEmail = scheduled.recipient_email || proposal.manual_client_email || proposal.clientes?.email;
        const clientPhone = scheduled.recipient_phone || proposal.manual_client_phone || proposal.clientes?.numero;
        const senderName = config.gmail_sender_name || "Equipe";

        const publishedUrl = "https://atendimento-astros-acd.lovable.app";
        const proposalLink = `${publishedUrl}/proposta/${proposal.id}?token=${proposal.share_token}`;

        const results = { email: { sent: false, error: null as string | null }, whatsapp: { sent: false, error: null as string | null } };

        // Send Email
        if ((scheduled.channel === "email" || scheduled.channel === "both") && config.email_enabled && clientEmail) {
          try {
            if (!config.gmail_user || !config.gmail_app_password) {
              results.email.error = "Gmail não configurado";
            } else {
              const subject = toAsciiHeader(`Proposta Comercial: ${proposal.title}`) || "Proposta Comercial";
              const htmlBody = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;background:#f4f4f5;padding:40px 20px;"><table style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:40px;text-align:center;"><h1 style="color:#fff;margin:0;">Proposta Comercial</h1></td></tr><tr><td style="padding:40px;"><p>Olá <strong>${clientName}</strong>,</p><p>Sua proposta comercial está pronta!</p><table style="width:100%;margin:30px 0;"><tr><td style="background:#f8fafc;border-radius:8px;padding:24px;border-left:4px solid #3b82f6;"><p style="color:#64748b;font-size:12px;text-transform:uppercase;">PROPOSTA</p><p style="font-size:20px;font-weight:600;">${proposal.title}</p></td></tr></table><p style="text-align:center;"><a href="${proposalLink}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;padding:16px 48px;border-radius:8px;text-decoration:none;font-weight:600;">Visualizar Proposta</a></p></td></tr><tr><td style="background:#f8fafc;padding:30px 40px;border-top:1px solid #e5e7eb;"><p>Atenciosamente,</p><p style="font-weight:600;">${senderName}</p></td></tr></table></body></html>`;

              const client = new SMTPClient({
                connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: config.gmail_user, password: config.gmail_app_password } },
              });

              const fromAddress = config.gmail_sender_name
                ? `${toAsciiHeader(config.gmail_sender_name)} <${config.gmail_user}>`
                : config.gmail_user;

              await client.send({
                from: fromAddress,
                to: clientEmail,
                subject,
                content: `Olá ${clientName}, sua proposta "${proposal.title}" está pronta. Visualizar: ${proposalLink}`,
                html: htmlBody,
              });
              await client.close();

              results.email.sent = true;
              console.log(`✅ Email enviado para: ${clientEmail}`);

              await supabase.from("proposal_send_logs").insert({
                proposal_id: scheduled.proposal_id, channel: "email", recipient: clientEmail, status: "sent",
              });
            }
          } catch (err: any) {
            results.email.error = err?.message || "Erro";
            await supabase.from("proposal_send_logs").insert({
              proposal_id: scheduled.proposal_id, channel: "email", recipient: clientEmail, status: "error", error_message: results.email.error,
            });
          }
        }

        // Send WhatsApp
        if ((scheduled.channel === "whatsapp" || scheduled.channel === "both") && config.whatsapp_enabled && clientPhone) {
          try {
            if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
              results.whatsapp.error = "Evolution API não configurada";
            } else {
              let cleanNumber = clientPhone.replace(/\D/g, "");
              if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) cleanNumber = "55" + cleanNumber;

              const message = `🎉 *Olá, ${clientName}!*\n\nSua proposta comercial está pronta!\n\n📄 *Proposta:* ${proposal.title}\n\n👇 *Clique no link abaixo para visualizar:*\n${proposalLink}\n\n_Atenciosamente,_\n*${senderName}*`;

              const response = await fetch(`${config.evolution_api_url}/message/sendText/${config.evolution_instance_name}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: config.evolution_api_key },
                body: JSON.stringify({ number: cleanNumber, text: message }),
              });

              if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

              results.whatsapp.sent = true;
              console.log(`✅ WhatsApp enviado para: ${cleanNumber}`);

              await supabase.from("proposal_send_logs").insert({
                proposal_id: scheduled.proposal_id, channel: "whatsapp", recipient: cleanNumber, status: "sent",
              });
            }
          } catch (err: any) {
            results.whatsapp.error = err?.message || "Erro";
            await supabase.from("proposal_send_logs").insert({
              proposal_id: scheduled.proposal_id, channel: "whatsapp", recipient: clientPhone, status: "error", error_message: results.whatsapp.error,
            });
          }
        }

        // Update scheduled send
        if (results.email.sent || results.whatsapp.sent) {
          await supabase.from("proposal_scheduled_sends").update({
            status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", scheduled.id);

          // Update proposal status
          await supabase.from("proposals").update({ status: "sent" }).eq("id", scheduled.proposal_id);

          // Trigger Baserow lead creation
          try {
            const cleanPhone = (clientPhone || '').replace(/\D/g, '');
            if (cleanPhone) {
              console.log(`📦 Triggering Baserow lead creation for scheduled proposal`);
              const baserowResp = await fetch(`${supabaseUrl}/functions/v1/baserow-create-lead`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                  'apikey': supabaseKey,
                },
                body: JSON.stringify({
                  module: 'proposals',
                  event: 'proposta.enviada',
                  lead_name: clientName,
                  lead_phone: cleanPhone,
                  lead_date: new Date().toLocaleDateString('pt-BR'),
                  lead_produto: proposal.title,
                }),
              });

              const baserowText = await baserowResp.text();
              if (!baserowResp.ok) {
                console.error(`❌ Baserow error ${baserowResp.status}: ${baserowText}`);
              } else {
                console.log(`📦 Baserow response (proposta.enviada): ${baserowText}`);
              }
            }
          } catch (baserowErr: any) {
            console.error('⚠️ Baserow lead creation failed (non-blocking):', baserowErr.message);
          }

          processed++;
        } else {
          const errorMsg = [results.email.error, results.whatsapp.error].filter(Boolean).join("; ");
          await supabase.from("proposal_scheduled_sends").update({
            status: "error", error_message: errorMsg, updated_at: new Date().toISOString(),
          }).eq("id", scheduled.id);
          errors++;
        }
      } catch (err: any) {
        await supabase.from("proposal_scheduled_sends").update({
          status: "error", error_message: err.message || "Erro desconhecido", updated_at: new Date().toISOString(),
        }).eq("id", scheduled.id);
        errors++;
      }
    }

    console.log(`✅ Finished: ${processed} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
