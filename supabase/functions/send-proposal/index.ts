import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendProposalRequest {
  proposalId: string;
  channel: 'email' | 'whatsapp' | 'both';
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendProposalRequest = await req.json();
    const { proposalId, channel, recipientEmail, recipientPhone, recipientName } = body;

    if (!proposalId || !channel) {
      return new Response(JSON.stringify({ error: "proposalId e channel são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*, clientes(*)')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: "Proposta não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch send config
    const { data: config } = await supabase
      .from('proposal_send_config')
      .select('*')
      .limit(1)
      .single();

    if (!config) {
      return new Response(JSON.stringify({ error: "Configuração de envio não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', user.id)
      .single();

    const senderEmail = user.email || '';
    const senderName = userProfile?.name || senderEmail;

    // Determine recipient info
    const clientName = recipientName || proposal.manual_client_name || proposal.clientes?.nome || 'Cliente';
    const clientEmail = recipientEmail || proposal.manual_client_email || proposal.clientes?.email;
    const clientPhone = recipientPhone || proposal.manual_client_phone || proposal.clientes?.numero;

    // Generate proposal link
    const baseUrl = Deno.env.get("SITE_URL") || supabaseUrl.replace('.supabase.co', '.lovable.app');
    const proposalLink = `${baseUrl}/proposta/${proposalId}?token=${proposal.share_token}`;

    const results = {
      email: { sent: false, error: null as string | null },
      whatsapp: { sent: false, error: null as string | null },
    };

    // Send Email
    if ((channel === 'email' || channel === 'both') && config.email_enabled && clientEmail) {
      try {
        if (!config.gmail_user || !config.gmail_app_password) {
          results.email.error = 'Gmail não configurado';
        } else {
          // Replace template variables
          const subject = (config.email_subject_template || 'Proposta Comercial - {{titulo}}')
            .replace('{{titulo}}', proposal.title)
            .replace('{{cliente_nome}}', clientName);

          const htmlBody = (config.email_body_template || '')
            .replace(/\{\{titulo\}\}/g, proposal.title)
            .replace(/\{\{cliente_nome\}\}/g, clientName)
            .replace(/\{\{link\}\}/g, proposalLink);

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
            subject: subject,
            content: "Este email requer um cliente com suporte a HTML.",
            html: htmlBody,
          });

          await client.close();
          results.email.sent = true;
          console.log(`✅ Email enviado para: ${clientEmail}`);

          // Log
          await supabase.from('proposal_send_logs').insert({
            proposal_id: proposalId,
            channel: 'email',
            recipient: clientEmail,
            status: 'sent',
            sent_by: user.id,
            sent_by_email: senderEmail,
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao enviar email:', error);
        results.email.error = error?.message || 'Erro desconhecido';
        
        await supabase.from('proposal_send_logs').insert({
          proposal_id: proposalId,
          channel: 'email',
          recipient: clientEmail,
          status: 'error',
          error_message: results.email.error,
          sent_by: user.id,
          sent_by_email: senderEmail,
        });
      }
    } else if ((channel === 'email' || channel === 'both') && !clientEmail) {
      results.email.error = 'Email do cliente não disponível';
    } else if ((channel === 'email' || channel === 'both') && !config.email_enabled) {
      results.email.error = 'Envio por email desabilitado';
    }

    // Send WhatsApp
    if ((channel === 'whatsapp' || channel === 'both') && config.whatsapp_enabled && clientPhone) {
      try {
        if (!config.evolution_api_url || !config.evolution_api_key || !config.evolution_instance_name) {
          results.whatsapp.error = 'Evolution API não configurada';
        } else {
          // Format phone number
          let cleanNumber = clientPhone.replace(/\D/g, '');
          if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
            cleanNumber = '55' + cleanNumber;
          }

          // Replace template variables
          const message = (config.whatsapp_message_template || 'Sua proposta: {{link}}')
            .replace(/\{\{titulo\}\}/g, proposal.title)
            .replace(/\{\{cliente_nome\}\}/g, clientName)
            .replace(/\{\{link\}\}/g, proposalLink);

          const url = `${config.evolution_api_url}/message/sendText/${config.evolution_instance_name}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.evolution_api_key,
            },
            body: JSON.stringify({
              number: cleanNumber,
              text: message,
            }),
          });

          if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`HTTP ${response.status}: ${responseText}`);
          }

          results.whatsapp.sent = true;
          console.log(`✅ WhatsApp enviado para: ${cleanNumber}`);

          // Log
          await supabase.from('proposal_send_logs').insert({
            proposal_id: proposalId,
            channel: 'whatsapp',
            recipient: cleanNumber,
            status: 'sent',
            sent_by: user.id,
            sent_by_email: senderEmail,
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao enviar WhatsApp:', error);
        results.whatsapp.error = error?.message || 'Erro desconhecido';
        
        await supabase.from('proposal_send_logs').insert({
          proposal_id: proposalId,
          channel: 'whatsapp',
          recipient: clientPhone,
          status: 'error',
          error_message: results.whatsapp.error,
          sent_by: user.id,
          sent_by_email: senderEmail,
        });
      }
    } else if ((channel === 'whatsapp' || channel === 'both') && !clientPhone) {
      results.whatsapp.error = 'Telefone do cliente não disponível';
    } else if ((channel === 'whatsapp' || channel === 'both') && !config.whatsapp_enabled) {
      results.whatsapp.error = 'Envio por WhatsApp desabilitado';
    }

    // Update proposal status to sent if at least one channel succeeded
    if (results.email.sent || results.whatsapp.sent) {
      await supabase
        .from('proposals')
        .update({ status: 'sent' })
        .eq('id', proposalId);

      // Log history
      await supabase.from('proposal_history').insert({
        proposal_id: proposalId,
        action: 'sent',
        user_id: user.id,
        user_email: senderEmail,
        user_name: senderName,
        changes: {
          email_sent: results.email.sent,
          whatsapp_sent: results.whatsapp.sent,
          recipient_email: clientEmail,
          recipient_phone: clientPhone,
        },
      });
    }

    return new Response(JSON.stringify({
      success: results.email.sent || results.whatsapp.sent,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
