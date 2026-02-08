import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  proposal_id: string;
  new_status: 'accepted' | 'rejected';
  old_status: string;
  signed_name?: string;
  rejection_reason?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotifyRequest = await req.json();
    const { proposal_id, new_status, signed_name, rejection_reason } = body;

    console.log(`📨 proposal-status-notify: proposal=${proposal_id}, status=${new_status}`);

    if (!proposal_id || !new_status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch notification config
    const { data: config } = await supabase
      .from('proposal_status_notifications')
      .select('*')
      .limit(1)
      .single();

    if (!config || !config.enabled) {
      console.log('⏭️ Status notifications disabled');
      return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this specific status type is enabled
    const isAccept = new_status === 'accepted';
    const typeEnabled = isAccept ? config.accept_enabled : config.reject_enabled;
    if (!typeEnabled) {
      console.log(`⏭️ ${new_status} notifications disabled`);
      return new Response(JSON.stringify({ skipped: true, reason: `${new_status} disabled` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch proposal details
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*, clientes(*)')
      .eq('id', proposal_id)
      .single();

    if (proposalError || !proposal) {
      console.error('❌ Proposal not found:', proposalError);
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine recipient info
    const clientName = signed_name || proposal.manual_client_name || proposal.clientes?.nome || 'Cliente';
    const clientPhone = proposal.manual_client_phone || proposal.clientes?.numero;
    const clientEmail = proposal.manual_client_email || proposal.clientes?.email;

    // Get message template and channel
    const channel = isAccept ? config.accept_channel : config.reject_channel;
    let messageTemplate = isAccept ? config.accept_message_template : config.reject_message_template;

    // Replace placeholders
    const message = (messageTemplate || '')
      .replace(/\{nome\}/g, clientName)
      .replace(/\{titulo\}/g, proposal.title || 'Proposta')
      .replace(/\{motivo\}/g, rejection_reason || 'Não informado');

    console.log(`📝 Message: ${message.substring(0, 100)}...`);
    console.log(`📡 Channel: ${channel}`);

    // Fetch send config for SMTP/WhatsApp credentials
    const { data: sendConfig } = await supabase
      .from('proposal_send_config')
      .select('*')
      .limit(1)
      .single();

    if (!sendConfig) {
      console.error('❌ Send config not found');
      await logNotification(supabase, proposal_id, new_status, 'error', '', message, 'Send config not found');
      return new Response(JSON.stringify({ error: "Send config not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { whatsapp: false, email: false, errors: [] as string[] };

    // Send WhatsApp
    if ((channel === 'whatsapp' || channel === 'both') && clientPhone) {
      try {
        if (!sendConfig.evolution_api_url || !sendConfig.evolution_api_key || !sendConfig.evolution_instance_name) {
          results.errors.push('WhatsApp: Evolution API não configurada');
        } else {
          let cleanNumber = clientPhone.replace(/\D/g, '');
          if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
            cleanNumber = '55' + cleanNumber;
          }

          const url = `${sendConfig.evolution_api_url}/message/sendText/${sendConfig.evolution_instance_name}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': sendConfig.evolution_api_key,
            },
            body: JSON.stringify({ number: cleanNumber, text: message }),
          });

          if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`HTTP ${response.status}: ${responseText}`);
          }

          results.whatsapp = true;
          console.log(`✅ WhatsApp sent to: ${cleanNumber}`);
          await logNotification(supabase, proposal_id, new_status, 'sent', cleanNumber, message);
        }
      } catch (error: any) {
        console.error('❌ WhatsApp error:', error);
        results.errors.push(`WhatsApp: ${error?.message || 'Unknown error'}`);
        await logNotification(supabase, proposal_id, new_status, 'error', clientPhone || '', message, error?.message);
      }
    }

    // Send Email
    if ((channel === 'email' || channel === 'both') && clientEmail) {
      try {
        if (!sendConfig.gmail_user || !sendConfig.gmail_app_password) {
          results.errors.push('Email: Gmail não configurado');
        } else {
          // Dynamic import for denomailer
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
          
          const client = new SMTPClient({
            connection: {
              hostname: "smtp.gmail.com",
              port: 465,
              tls: true,
              auth: {
                username: sendConfig.gmail_user,
                password: sendConfig.gmail_app_password,
              },
            },
          });

          const subjectPrefix = isAccept ? '✅ Proposta Aceita' : '❌ Proposta Recusada';
          const subject = `${subjectPrefix}: ${proposal.title}`;
          const fromAddress = sendConfig.gmail_sender_name
            ? `${sendConfig.gmail_sender_name} <${sendConfig.gmail_user}>`
            : sendConfig.gmail_user;

          await client.send({
            from: fromAddress,
            to: clientEmail,
            subject,
            content: message,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:${isAccept ? '#16a34a' : '#dc2626'}">${subjectPrefix}</h2>
              <p style="font-size:16px;line-height:1.6;white-space:pre-line;">${message}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="color:#9ca3af;font-size:12px;">Mensagem automática</p>
            </div>`,
          });

          await client.close();

          results.email = true;
          console.log(`✅ Email sent to: ${clientEmail}`);
          await logNotification(supabase, proposal_id, new_status, 'sent', clientEmail, message);
        }
      } catch (error: any) {
        console.error('❌ Email error:', error);
        results.errors.push(`Email: ${error?.message || 'Unknown error'}`);
        await logNotification(supabase, proposal_id, new_status, 'error', clientEmail || '', message, error?.message);
      }
    }

    return new Response(JSON.stringify({
      success: results.whatsapp || results.email,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('❌ General error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logNotification(
  supabase: any,
  proposalId: string,
  statusChange: string,
  status: string,
  recipient: string,
  message: string,
  errorMessage?: string
) {
  try {
    await supabase.from('proposal_status_notification_logs').insert({
      proposal_id: proposalId,
      status_change: statusChange,
      channel: 'whatsapp',
      recipient,
      message_sent: message,
      status,
      error_message: errorMessage || null,
    });
  } catch (err) {
    console.error('Failed to log notification:', err);
  }
}
