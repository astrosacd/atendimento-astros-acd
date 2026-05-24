import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface NotifyRequest {
  proposal_id: string;
  new_status: 'sent' | 'accepted' | 'rejected' | 'viewed';
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

    const clientName = signed_name || proposal.manual_client_name || proposal.clientes?.nome || 'Cliente';
    const clientPhone = proposal.manual_client_phone || proposal.clientes?.numero;
    const clientEmail = proposal.manual_client_email || proposal.clientes?.email;

    // === WEBHOOKS: Fire for all status changes (sent, viewed, accepted, rejected) ===
    await fireProposalWebhooks(supabase, proposal, new_status, clientName, clientPhone, clientEmail, rejection_reason);

    // === BASEROW: Create lead for relevant events ===
    await createBaserowLead(supabaseUrl, 'proposals', new_status, clientName, clientPhone, proposal.title);

    // === NOTIFICATIONS: Only for accepted/rejected ===
    if (new_status !== 'accepted' && new_status !== 'rejected') {
      return new Response(JSON.stringify({ success: true, webhooks_only: true }), {
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

    const isAccept = new_status === 'accepted';
    const typeEnabled = isAccept ? config.accept_enabled : config.reject_enabled;
    if (!typeEnabled) {
      console.log(`⏭️ ${new_status} notifications disabled`);
      return new Response(JSON.stringify({ skipped: true, reason: `${new_status} disabled` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get message template and channel
    const channel = isAccept ? config.accept_channel : config.reject_channel;
    const messageTemplate = isAccept ? config.accept_message_template : config.reject_message_template;

    const message = replaceTemplatePlaceholders(messageTemplate || '', clientName, proposal.title, rejection_reason);

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

    const results = { whatsapp: false, email: false, manager_whatsapp: false, errors: [] as string[] };

    // Send to CLIENT
    if ((channel === 'whatsapp' || channel === 'both') && clientPhone) {
      const ok = await sendWhatsApp(sendConfig, clientPhone, message);
      if (ok) {
        results.whatsapp = true;
        await logNotification(supabase, proposal_id, new_status, 'sent', clientPhone, message);
      } else {
        results.errors.push('WhatsApp: falha ao enviar para cliente');
        await logNotification(supabase, proposal_id, new_status, 'error', clientPhone, message, 'Send failed');
      }
    }

    if ((channel === 'email' || channel === 'both') && clientEmail) {
      const ok = await sendEmail(sendConfig, clientEmail, isAccept, proposal.title, message);
      if (ok) {
        results.email = true;
        await logNotification(supabase, proposal_id, new_status, 'sent', clientEmail, message);
      } else {
        results.errors.push('Email: falha ao enviar para cliente');
        await logNotification(supabase, proposal_id, new_status, 'error', clientEmail, message, 'Send failed');
      }
    }

    // Send to MANAGERS (with configurable delay between sends)
    if (config.manager_notify_enabled && config.manager_numbers?.length > 0) {
      const managerMsg = replaceTemplatePlaceholders(
        isAccept ? (config.manager_accept_message || '') : (config.manager_reject_message || ''),
        clientName, proposal.title, rejection_reason
      );

      const delaySeconds = config.manager_delay_seconds ?? 5;

      for (let i = 0; i < config.manager_numbers.length; i++) {
        const number = config.manager_numbers[i];
        if (!number.trim()) continue;

        // Apply delay between managers (not before the first one)
        if (i > 0 && delaySeconds > 0) {
          console.log(`⏳ Waiting ${delaySeconds}s before next manager...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }

        const ok = await sendWhatsApp(sendConfig, number.trim(), managerMsg);
        if (ok) {
          results.manager_whatsapp = true;
          console.log(`✅ Manager notified: ${number}`);
        } else {
          results.errors.push(`Manager WhatsApp falhou: ${number}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: results.whatsapp || results.email || results.manager_whatsapp,
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

function replaceTemplatePlaceholders(template: string, name: string, title: string, reason?: string): string {
  return template
    .replace(/\{nome\}/g, name)
    .replace(/\{titulo\}/g, title || 'Proposta')
    .replace(/\{motivo\}/g, reason || 'Não informado');
}

async function sendWhatsApp(sendConfig: any, phone: string, message: string): Promise<boolean> {
  try {
    if (!sendConfig.evolution_api_url || !sendConfig.evolution_api_key || !sendConfig.evolution_instance_name) {
      console.error('WhatsApp: Evolution API não configurada');
      return false;
    }

    let cleanNumber = phone.replace(/\D/g, '');
    if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
      cleanNumber = '55' + cleanNumber;
    }

    const url = `${sendConfig.evolution_api_url}/message/sendText/${sendConfig.evolution_instance_name}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': sendConfig.evolution_api_key },
      body: JSON.stringify({ number: cleanNumber, text: message }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`WhatsApp HTTP ${response.status}: ${responseText}`);
      return false;
    }

    console.log(`✅ WhatsApp sent to: ${cleanNumber}`);
    return true;
  } catch (error: any) {
    console.error('❌ WhatsApp error:', error);
    return false;
  }
}

async function sendEmail(sendConfig: any, email: string, isAccept: boolean, title: string, message: string): Promise<boolean> {
  try {
    if (!sendConfig.gmail_user || !sendConfig.gmail_app_password) {
      console.error('Email: Gmail não configurado');
      return false;
    }

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: sendConfig.gmail_user, password: sendConfig.gmail_app_password },
      },
    });

    const subjectPrefix = isAccept ? '✅ Proposta Aceita' : '❌ Proposta Recusada';
    const subject = `${subjectPrefix}: ${title}`;
    const fromAddress = sendConfig.gmail_sender_name
      ? `${sendConfig.gmail_sender_name} <${sendConfig.gmail_user}>`
      : sendConfig.gmail_user;

    await client.send({
      from: fromAddress,
      to: email,
      subject,
      content: message,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:${isAccept ? '#16a34a' : '#dc2626'}">${subjectPrefix}</h2>
        <p style="font-size:16px;line-height:1.6;white-space:pre-line;">${message}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:12px;">Conectando Visões, Ampliando Resultados.</p>
      </div>`,
    });

    await client.close();
    console.log(`✅ Email sent to: ${email}`);
    return true;
  } catch (error: any) {
    console.error('❌ Email error:', error);
    return false;
  }
}

async function fireProposalWebhooks(
  supabase: any,
  proposal: any,
  status: string,
  clientName: string,
  clientPhone: string | null,
  clientEmail: string | null,
  rejectionReason?: string,
) {
  try {
    const eventMap: Record<string, string> = {
      'sent': 'proposta.enviada',
      'viewed': 'proposta.visualizada',
      'accepted': 'proposta.aceita',
      'rejected': 'proposta.recusada',
    };
    const evento = eventMap[status];
    if (!evento) return;

    const { data: webhooks } = await supabase
      .from('proposal_webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('eventos', [evento]);

    if (!webhooks?.length) return;

    const payload = {
      evento,
      timestamp: new Date().toISOString(),
      proposta: {
        id: proposal.id,
        titulo: proposal.title,
        status,
        valor_total: proposal.total_value,
      },
      cliente: {
        nome: clientName,
        telefone: clientPhone || null,
        email: clientEmail || null,
      },
      ...(rejectionReason ? { motivo_recusa: rejectionReason } : {}),
    };

    for (const webhook of webhooks) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (webhook.secret_key) headers['X-Webhook-Secret'] = webhook.secret_key;

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

        await supabase.from('proposal_webhook_logs').insert({
          webhook_id: webhook.id,
          proposal_id: proposal.id,
          evento,
          payload,
          response_status: response.status,
          response_body: responseText.substring(0, 1000),
          success: response.ok,
        });

        await supabase.from('proposal_webhooks').update({ last_triggered_at: new Date().toISOString() }).eq('id', webhook.id);

        console.log(`🔗 Webhook ${webhook.nome}: ${response.status}`);
      } catch (err: any) {
        console.error(`❌ Webhook ${webhook.nome} error:`, err);
        await supabase.from('proposal_webhook_logs').insert({
          webhook_id: webhook.id,
          proposal_id: proposal.id,
          evento,
          payload,
          response_status: 0,
          response_body: err?.message || 'Unknown error',
          success: false,
        });
      }
    }
  } catch (err) {
    console.error('❌ Webhook system error:', err);
  }
}

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

async function createBaserowLead(
  supabaseUrl: string,
  module: string,
  status: string,
  clientName: string,
  clientPhone: string | null,
  proposalTitle?: string,
) {
  if (!clientPhone) return;

  const eventMap: Record<string, string> = {
    'sent': 'proposta.enviada',
    'viewed': 'proposta.visualizada',
    'accepted': 'proposta.aceita',
    'rejected': 'proposta.recusada',
  };
  const event = eventMap[status];
  if (!event) return;

  try {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || '';
    const payload = {
      module,
      event,
      lead_name: clientName,
      lead_phone: clientPhone,
      lead_date: new Date().toLocaleDateString('pt-BR'),
    };

    console.log(`📦 [proposal-status-notify] sending to Baserow: ${JSON.stringify(payload)}`);

    const resp = await fetch(`${supabaseUrl}/functions/v1/baserow-create-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.text();
    if (!resp.ok) {
      console.error(`❌ [proposal-status-notify] Baserow HTTP error (${module}/${event}): ${resp.status} - ${result}`);
      return;
    }

    console.log(`✅ [proposal-status-notify] Baserow response (${module}/${event}): ${result}`);
  } catch (err: any) {
    console.error(`❌ Baserow lead creation error:`, err.message);
  }
}
