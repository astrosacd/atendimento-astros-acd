import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
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
  isRemarketing?: boolean;
  remarketingMessage?: string;
}

// Professional HTML email template
function generateEmailHtml(
  clientName: string,
  proposalTitle: string,
  proposalLink: string,
  senderName: string,
  companyName?: string,
  isRemarketing?: boolean,
  remarketingMessage?: string
): string {
  const companyHtml = companyName
    ? `<p style="color:#6b7280;font-size:14px;margin:5px 0 0 0;">${companyName}</p>`
    : '';

  // Remarketing has different intro text
  const introText = isRemarketing 
    ? `<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">${remarketingMessage || 'Percebi que você visualizou a proposta, mas ainda não deu seu retorno. Posso ajudar com alguma dúvida?'}</p>`
    : `<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">É com grande satisfação que enviamos sua proposta comercial personalizada:</p>`;

  const headerColor = isRemarketing ? '#f97316' : '#3b82f6'; // orange for remarketing
  const headerGradient = isRemarketing 
    ? 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)' 
    : 'linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)';
  const buttonGradient = isRemarketing 
    ? 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)' 
    : 'linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)';
  const buttonShadow = isRemarketing 
    ? 'rgba(249,115,22,0.4)' 
    : 'rgba(59,130,246,0.4)';
  const headerTitle = isRemarketing ? 'Lembrete: Sua Proposta' : 'Proposta Comercial';

  // IMPORTANT: keep template ASCII-friendly to reduce encoding issues
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${headerTitle}</title></head><body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f4f5;"><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:${headerGradient};padding:40px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:600;">${headerTitle}</h1></td></tr><tr><td style="padding:40px;"><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px 0;">Olá <strong>${clientName}</strong>,</p>${introText}<table role="presentation" style="width:100%;border-collapse:collapse;margin:30px 0;"><tr><td style="background-color:#f8fafc;border-radius:8px;padding:24px;border-left:4px solid ${headerColor};"><p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">PROPOSTA</p><p style="color:#1e293b;font-size:20px;font-weight:600;margin:0;">${proposalTitle}</p></td></tr></table><p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 30px 0;">Clique no botão abaixo para visualizar todos os detalhes, valores e condições da proposta:</p><table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center"><a href="${proposalLink}" style="display:inline-block;background:${buttonGradient};color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:16px;font-weight:600;box-shadow:0 4px 14px ${buttonShadow};">Visualizar Proposta</a></td></tr></table><p style="color:#6b7280;font-size:14px;line-height:1.6;margin:40px 0 0 0;text-align:center;">Caso o botão não funcione, copie e cole o link abaixo no seu navegador:</p><p style="color:${headerColor};font-size:12px;word-break:break-all;text-align:center;margin:10px 0 0 0;">${proposalLink}</p></td></tr><tr><td style="background-color:#f8fafc;padding:30px 40px;border-top:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:14px;margin:0 0 10px 0;">Atenciosamente,</p><p style="color:#374151;font-size:16px;font-weight:600;margin:0;">${senderName}</p>${companyHtml}<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"><p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">Conectando Visões, Ampliando Resultados.</p></td></tr></table></td></tr></table></body></html>`;
}

// Professional WhatsApp message template
function generateWhatsAppMessage(
  clientName: string,
  proposalTitle: string,
  proposalLink: string,
  senderName: string,
  isRemarketing?: boolean,
  remarketingMessage?: string
): string {
  if (isRemarketing && remarketingMessage) {
    return `${remarketingMessage}

👇 *Acesse sua proposta:*
${proposalLink}

_Atenciosamente,_
*${senderName}*`;
  }

  if (isRemarketing) {
    return `👋 *Olá, ${clientName}!*

Percebi que você visualizou a proposta "${proposalTitle}" mas ainda não deu seu retorno.

Posso ajudar com alguma dúvida? Estou à disposição!

👇 *Acesse a proposta novamente:*
${proposalLink}

_Atenciosamente,_
*${senderName}*`;
  }

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

// Keep email headers ASCII-friendly to avoid clients showing raw encoded headers.
// Body can remain UTF-8 (HTML meta charset already set).
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
    const { proposalId, channel, recipientEmail, recipientPhone, recipientName, enablePasswordProtection, autoPassword, passwordChannel, isRemarketing, remarketingMessage } = body;

    // --- Input validation ---
    // Validate proposalId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!proposalId || typeof proposalId !== 'string' || !uuidRegex.test(proposalId)) {
      return new Response(JSON.stringify({ error: "proposalId inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!channel || !['email', 'whatsapp', 'both'].includes(channel)) {
      return new Response(JSON.stringify({ error: "channel deve ser 'email', 'whatsapp' ou 'both'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format if provided
    if (recipientEmail && (typeof recipientEmail !== 'string' || recipientEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) {
      return new Response(JSON.stringify({ error: "Formato de email inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate phone format if provided (digits only after cleanup, reasonable length)
    if (recipientPhone && (typeof recipientPhone !== 'string' || recipientPhone.length > 30)) {
      return new Response(JSON.stringify({ error: "Formato de telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate string lengths
    if (recipientName && (typeof recipientName !== 'string' || recipientName.length > 200)) {
      return new Response(JSON.stringify({ error: "Nome do destinatário muito longo (máx 200)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (remarketingMessage && (typeof remarketingMessage !== 'string' || remarketingMessage.length > 2000)) {
      return new Response(JSON.stringify({ error: "Mensagem de remarketing muito longa (máx 2000)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (passwordChannel && !['whatsapp', 'email'].includes(passwordChannel)) {
      return new Response(JSON.stringify({ error: "passwordChannel deve ser 'whatsapp' ou 'email'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('📨 send-proposal request', {
      proposalId,
      channel,
      recipientEmail: recipientEmail ? '[provided]' : null,
      recipientPhone: recipientPhone ? '[provided]' : null,
      enablePasswordProtection,
      passwordChannel,
      isRemarketing,
      remarketingMessage: remarketingMessage ? '[provided]' : null,
    });

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

    // IMPORTANT: aplica proteção por senha independentemente do resultado do envio
    // (o usuário quer que o link já passe a exigir senha ao marcar a opção)
    if (enablePasswordProtection && autoPassword) {
      // Hash the password using bcrypt before storing
      // This ensures passwords are never stored in plain text
      const hashedPassword = await bcrypt.hash(autoPassword);
      console.log('🔐 Password hashed with bcrypt for secure storage');
      
      const { error: updateErr } = await supabase
        .from('proposals')
        .update({
          is_password_protected: true,
          password_hash: hashedPassword,
          password_channel: passwordChannel || 'whatsapp',
        })
        .eq('id', proposalId);

      if (updateErr) {
        console.error('❌ Error updating password protection:', updateErr);
      } else {
        console.log('📝 Password protection enabled for proposal:', proposalId);
      }
    } else {
      // Se desmarcou, remove proteção
      await supabase
        .from('proposals')
        .update({
          is_password_protected: false,
          password_hash: null,
          password_channel: null,
        })
        .eq('id', proposalId);
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
            undefined,
            isRemarketing,
            remarketingMessage
          );

          const subjectPrefix = isRemarketing ? 'Lembrete - ' : '';
          const subject = toAsciiHeader(`${subjectPrefix}Proposta Comercial: ${proposal.title}`) || 'Proposta Comercial';
          
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
            ? `${toAsciiHeader(config.gmail_sender_name)} <${config.gmail_user}>` 
            : config.gmail_user;

          // Use denomailer's high-level fields (html + plain text fallback)
          // to let it build correct MIME boundaries.
          await client.send({
            from: fromAddress,
            to: clientEmail,
            subject,
            content: `Olá ${clientName},\n\nSua proposta "${proposal.title}" está pronta.\n\nVisualizar: ${proposalLink}`,
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
            config.gmail_sender_name || senderName,
            isRemarketing,
            remarketingMessage
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
      // Only update status - password protection was already set above with proper hashing
      // We don't re-set password_hash here to avoid overwriting the hashed password
      await supabase
        .from('proposals')
        .update({ status: 'sent' })
        .eq('id', proposalId);

      // Log history
      await supabase.from('proposal_history').insert({
        proposal_id: proposalId,
        action: isRemarketing ? 'remarketing' : 'sent',
        user_id: user.id,
        user_email: senderEmail,
        user_name: senderName,
        changes: {
          email_sent: results.email.sent,
          whatsapp_sent: results.whatsapp.sent,
          recipient_email: clientEmail,
          recipient_phone: clientPhone,
          is_remarketing: isRemarketing || false,
          remarketing_message: isRemarketing ? remarketingMessage : undefined,
        },
      });

      // Trigger Baserow lead creation
      const baserowEvent = isRemarketing ? 'proposta.remarketing' : 'proposta.enviada';
      try {
        const cleanPhone = (clientPhone || '').replace(/\D/g, '');
        if (cleanPhone) {
          console.log(`📦 Triggering Baserow lead creation for event: ${baserowEvent}`);
          const baserowResp = await fetch(`${supabaseUrl}/functions/v1/baserow-create-lead`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
            body: JSON.stringify({
              module: 'proposals',
              event: baserowEvent,
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
            console.log(`📦 Baserow response (${baserowEvent}): ${baserowText}`);
          }
        }
      } catch (baserowErr: any) {
        console.error('⚠️ Baserow lead creation failed (non-blocking):', baserowErr.message);
      }
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
