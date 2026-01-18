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
  enablePasswordProtection?: boolean;
  autoPassword?: string;
  passwordChannel?: 'whatsapp' | 'email';
}

// Professional HTML email template
function generateEmailHtml(
  clientName: string,
  proposalTitle: string,
  proposalLink: string,
  senderName: string,
  companyName?: string
): string {
  const companyHtml = companyName
    ? `<p style="color:#6b7280;font-size:14px;margin:5px 0 0 0;">${companyName}</p>`
    : '';

  // IMPORTANT: keep template ASCII-friendly to reduce encoding issues
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Proposta Comercial</title></head><body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);padding:40px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">Proposta Comercial</h1></td></tr><tr><td style="padding:40px;"><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Olá <strong>${clientName}</strong>,</p><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">É com grande satisfação que enviamos sua proposta comercial personalizada:</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:30px 0;"><tr><td style="background-color:#f8fafc;border-radius:8px;padding:24px;border-left:4px solid #3b82f6;"><p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">PROPOSTA</p><p style="color:#1e293b;font-size:20px;font-weight:600;margin:0;">${proposalTitle}</p></td></tr></table><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px 0;">Clique no botão abaixo para visualizar todos os detalhes, valores e condições da proposta:</p><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center"><a href="${proposalLink}" style="display:inline-block;background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(59,130,246,0.4);">Visualizar Proposta</a></td></tr></table><p style="color:#6b7280;font-size:14px;line-height:1.6;margin:40px 0 0 0;text-align:center;">Caso o botão não funcione, copie e cole o link abaixo no seu navegador:</p><p style="color:#3b82f6;font-size:12px;word-break:break-all;text-align:center;margin:10px 0 0 0;">${proposalLink}</p></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;">Atenciosamente,</p><p style="color:#374151;font-size:16px;font-weight:600;margin:0;">${senderName}</p>${companyHtml}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">Conectando Visões, Ampliando Resultados.</p></td></tr></table></td></tr></table></body></html>`;
}

// Professional WhatsApp message template
function generateWhatsAppMessage(
  clientName: string,
  proposalTitle: string,
  proposalLink: string,
  senderName: string
): string {
  return `🎉 *Olá, ${clientName}!*

Sua proposta comercial está pronta!

📄 *Proposta:* ${proposalTitle}

Preparamos uma proposta especialmente para você com todos os detalhes, valores e condições.

👇 *Clique no link abaixo para visualizar:*
${proposalLink}

Estou à disposição para esclarecer qualquer dúvida!

_Atenciosamente,_
*${senderName}*`;
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
    const { proposalId, channel, recipientEmail, recipientPhone, recipientName, enablePasswordProtection, autoPassword, passwordChannel } = body;

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

    // Generate proposal link - USE PUBLISHED URL
    const publishedUrl = "https://atendimento-astros-acd.lovable.app";
    const proposalLink = `${publishedUrl}/proposta/${proposalId}?token=${proposal.share_token}`;

    console.log(`📍 Generated proposal link: ${proposalLink}`);

    const results = {
      email: { sent: false, error: null as string | null },
      whatsapp: { sent: false, error: null as string | null },
    };

    // Send Email using denomailer
    if ((channel === 'email' || channel === 'both') && config.email_enabled && clientEmail) {
      try {
        if (!config.gmail_user || !config.gmail_app_password) {
          results.email.error = 'Gmail não configurado';
        } else {
          // Generate professional email HTML
          const htmlBody = generateEmailHtml(
            clientName,
            proposal.title,
            proposalLink,
            config.gmail_sender_name || senderName,
            undefined
          );

           const subject = `Proposta Comercial: ${proposal.title}`;
          
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
            ? `"${config.gmail_sender_name}" <${config.gmail_user}>` 
            : config.gmail_user;

          await client.send({
            from: fromAddress,
            to: clientEmail,
            subject: subject,
            content: "Abra esta proposta no navegador caso seu email não suporte HTML.",
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

          // Generate professional WhatsApp message
          const message = generateWhatsAppMessage(
            clientName,
            proposal.title,
            proposalLink,
            config.gmail_sender_name || senderName
          );

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
      const updateData: Record<string, any> = { status: 'sent' };
      
      // Set password protection if enabled
      if (enablePasswordProtection && autoPassword) {
        updateData.is_password_protected = true;
        updateData.password_hash = autoPassword; // In production, you'd hash this
        updateData.password_channel = passwordChannel || 'whatsapp';
      }

      await supabase
        .from('proposals')
        .update(updateData)
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
