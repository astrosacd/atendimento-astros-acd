import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface ReceiptRequest {
  clienteId: string;
  paymentId?: string;
  paidAt?: string;
}

interface Cliente {
  id: string;
  nome: string;
  email: string;
  numero: string;
  produto: string;
  plano: string | null;
  valor: number;
  cpf: string;
  data_renovacao: string;
  moeda: string;
}

interface BillingConfig {
  [key: string]: string;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
}

const normalizeCompanyLabel = (value: string): string => {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

const generateProfessionalEmailHTML = (
  cliente: Cliente,
  paidAt: string,
  nextRenewal: string,
  companyName: string,
  receiptNumber: string
): string => {
  const currencySymbol = cliente.moeda === 'USD' ? '$' : 'R$';
  const formattedValue = `${currencySymbol} ${cliente.valor.toFixed(2)}`;
  const paidDate = new Date(paidAt).toLocaleDateString('pt-BR');
  const renewalDate = new Date(nextRenewal).toLocaleDateString('pt-BR');
  const normalizedCompany = (companyName || '').trim();
  const companyLine =
    normalizedCompany && normalizeCompanyLabel(normalizedCompany) !== 'sistema de gestao'
      ? `<p style="margin:0;color:#374151;font-size:15px;font-weight:600;">${normalizedCompany}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Recibo de Pagamento</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr>
<td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:30px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">RECIBO DE PAGAMENTO</h1>
<p style="margin:10px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Comprovante de pagamento confirmado</p>
</td>
</tr>

<!-- Receipt Number -->
<tr>
<td style="padding:20px 40px 0;text-align:center;">
<p style="margin:0;color:#6b7280;font-size:12px;">Recibo N&ordm;</p>
<p style="margin:5px 0 0;color:#111827;font-size:18px;font-weight:bold;font-family:monospace;">${receiptNumber}</p>
</td>
</tr>

<!-- Client Info -->
<tr>
<td style="padding:30px 40px 0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;border-radius:8px;padding:20px;">
<tr>
<td style="padding:20px;">
<h2 style="margin:0 0 15px;color:#374151;font-size:16px;font-weight:600;border-bottom:2px solid #10b981;padding-bottom:10px;">DADOS DO CLIENTE</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr>
<td style="padding:8px 0;color:#6b7280;font-size:14px;width:100px;">Nome:</td>
<td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;">${cliente.nome}</td>
</tr>
<tr>
<td style="padding:8px 0;color:#6b7280;font-size:14px;">Email:</td>
<td style="padding:8px 0;color:#111827;font-size:14px;">${cliente.email}</td>
</tr>
<tr>
<td style="padding:8px 0;color:#6b7280;font-size:14px;">CPF/CNPJ:</td>
<td style="padding:8px 0;color:#111827;font-size:14px;">${cliente.cpf}</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- Payment Details -->
<tr>
<td style="padding:20px 40px 0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;border-radius:8px;">
<tr>
<td style="padding:20px;">
<h2 style="margin:0 0 15px;color:#374151;font-size:16px;font-weight:600;border-bottom:2px solid #10b981;padding-bottom:10px;">DETALHES DO PAGAMENTO</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr>
<td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;">Produto:</td>
<td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;">${cliente.produto}</td>
</tr>
<tr>
<td style="padding:8px 0;color:#6b7280;font-size:14px;">Plano:</td>
<td style="padding:8px 0;color:#111827;font-size:14px;">${cliente.plano || 'N/A'}</td>
</tr>
<tr>
<td style="padding:8px 0;color:#6b7280;font-size:14px;">Data Pagamento:</td>
<td style="padding:8px 0;color:#111827;font-size:14px;">${paidDate}</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- Value Box -->
<tr>
<td style="padding:20px 40px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:8px;">
<tr>
<td style="padding:25px;text-align:center;">
<p style="margin:0;color:rgba(255,255,255,0.9);font-size:14px;text-transform:uppercase;">Valor Pago</p>
<p style="margin:10px 0 0;color:#ffffff;font-size:32px;font-weight:bold;">${formattedValue}</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Next Renewal -->
<tr>
<td style="padding:0 40px 30px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b;">
<tr>
<td style="padding:15px 20px;">
<p style="margin:0;color:#92400e;font-size:13px;">Proxima renovacao:</p>
<p style="margin:5px 0 0;color:#78350f;font-size:16px;font-weight:bold;">${renewalDate}</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#f9fafb;padding:25px 40px;text-align:center;border-top:1px solid #e5e7eb;">
${companyLine}
<p style="margin:${companyLine ? '8px' : '0'} 0 0;color:#6b7280;font-size:13px;">Obrigado pela confianca!</p>
<p style="margin:10px 0 0;color:#9ca3af;font-size:11px;">Este e um comprovante automatico. Guarde-o para sua referencia.</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
};

const generateProfessionalWhatsAppMessage = (
  cliente: Cliente,
  paidAt: string,
  nextRenewal: string,
  companyName: string,
  receiptNumber: string
): string => {
  const currencySymbol = cliente.moeda === 'USD' ? '$' : 'R$';
  const formattedValue = `${currencySymbol} ${cliente.valor.toFixed(2)}`;
  const paidDate = new Date(paidAt).toLocaleDateString('pt-BR');
  const renewalDate = new Date(nextRenewal).toLocaleDateString('pt-BR');
  const normalizedCompany = (companyName || '').trim();
  const companyBlock =
    normalizedCompany && normalizeCompanyLabel(normalizedCompany) !== 'sistema de gestao'
      ? `\n*${normalizedCompany}*`
      : '';

  return `━━━━━━━━━━━━━━━━━━━━━━
✅ *RECIBO DE PAGAMENTO*
━━━━━━━━━━━━━━━━━━━━━━

📋 *Recibo:* ${receiptNumber}

👤 *CLIENTE*
   Nome: ${cliente.nome}
   CPF/CNPJ: ${cliente.cpf}

📦 *SERVIÇO*
   Produto: ${cliente.produto}
   Plano: ${cliente.plano || 'N/A'}

💰 *PAGAMENTO*
   Valor: *${formattedValue}*
   Data: ${paidDate}

📅 *Próxima Renovação:* ${renewalDate}

━━━━━━━━━━━━━━━━━━━━━━${companyBlock}
🙏 Obrigado pela confiança!
━━━━━━━━━━━━━━━━━━━━━━`;
};

const sendEmailViaSMTP = async (
  gmailUser: string,
  gmailPassword: string,
  senderName: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`📧 Enviando recibo por email para: ${to}`);
    
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });

    const fromAddress = senderName ? `${senderName} <${gmailUser}>` : gmailUser;

    await client.send({
      from: fromAddress,
      to: to,
      subject: subject,
      content: "Este email requer um cliente com suporte a HTML.",
      html: html,
    });

    await client.close();
    console.log(`✅ Email de recibo enviado com sucesso para: ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Erro ao enviar email de recibo:`, error);
    return { success: false, error: error?.message || 'Erro desconhecido' };
  }
};

const sendWhatsAppMessage = async (
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Format phone number
    let cleanNumber = phone.replace(/\D/g, '');
    if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
      cleanNumber = '55' + cleanNumber;
    }
    
    const url = `${apiUrl}/message/sendText/${instanceName}`;
    console.log(`📱 Enviando recibo por WhatsApp para: ${cleanNumber}`);

    // Retry com backoff exponencial para erros transitórios da Evolution API
    // (broken pipe, connection reset, timeout, 5xx). 3 tentativas: 0ms, 1.5s, 4s.
    const MAX_ATTEMPTS = 3;
    const BACKOFF_MS = [0, 1500, 4000];
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (BACKOFF_MS[attempt - 1] > 0) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
        console.log(`🔁 Tentativa ${attempt}/${MAX_ATTEMPTS} para WhatsApp ${cleanNumber}`);
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify({ number: cleanNumber, text: message }),
        });

        const responseText = await response.text();

        if (response.ok) {
          console.log(`✅ WhatsApp de recibo enviado para ${cleanNumber} (tentativa ${attempt})`);
          return { success: true };
        }

        lastError = `HTTP ${response.status}: ${responseText}`;
        console.error(`❌ Erro WhatsApp tentativa ${attempt}:`, lastError);

        // Só vale a pena tentar de novo em erros 5xx; 4xx é erro do payload/instância.
        if (response.status < 500) {
          return { success: false, error: lastError };
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.error(`❌ Exceção WhatsApp tentativa ${attempt}:`, lastError);
        // Erros de rede (broken pipe, reset, timeout, fetch failed) → continuar tentando
      }
    }

    return { success: false, error: `Falhou após ${MAX_ATTEMPTS} tentativas. Último erro: ${lastError}` };
  } catch (error: any) {
    console.error(`❌ Erro ao enviar WhatsApp de recibo:`, error);
    return { success: false, error: error?.message || 'Erro desconhecido' };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clienteId, paymentId, paidAt }: ReceiptRequest = await req.json();

    if (!clienteId) {
      return new Response(
        JSON.stringify({ success: false, error: "clienteId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`\n🧾 ===== ENVIANDO RECIBO =====`);
    console.log(`   Cliente ID: ${clienteId}`);
    console.log(`   Payment ID: ${paymentId || 'N/A'}`);

    // Fetch cliente data
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (clienteError || !cliente) {
      console.error(`❌ Cliente não encontrado:`, clienteError);
      return new Response(
        JSON.stringify({ success: false, error: "Cliente não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`   Cliente: ${cliente.nome}`);
    console.log(`   Email: ${cliente.email}`);
    console.log(`   WhatsApp: ${cliente.numero}`);

    // Fetch billing config
    const { data: configData, error: configError } = await supabase
      .from('billing_config')
      .select('config_key, config_value');

    if (configError) {
      console.error(`❌ Erro ao carregar configurações:`, configError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao carregar configurações" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config: BillingConfig = {};
    configData?.forEach((item) => {
      config[item.config_key] = item.config_value;
    });

    // Check if receipt is enabled
    if (config.receipt_enabled !== 'true') {
      console.log(`⚠️ Emissão de recibo está desabilitada`);
      return new Response(
        JSON.stringify({ success: true, message: "Emissão de recibo desabilitada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentDate = paidAt || new Date().toISOString();
    const rawCompanyName = (config.billing_sender_name || config.receipt_company_name || '').trim();
    const companyName = rawCompanyName && normalizeCompanyLabel(rawCompanyName) !== 'sistema de gestao' ? rawCompanyName : '';
    const receiptNumber = `REC-${Date.now().toString(36).toUpperCase()}`;
    const results = {
      email: { sent: false, error: null as string | null },
      whatsapp: { sent: false, error: null as string | null },
    };

    // Save receipt number to the payment record if paymentId is provided
    if (paymentId) {
      const { error: updateError } = await supabase
        .from('client_payments')
        .update({ receipt_number: receiptNumber })
        .eq('id', paymentId);
      
      if (updateError) {
        console.log(`⚠️ Erro ao salvar número do recibo: ${updateError.message}`);
      } else {
        console.log(`📝 Número do recibo salvo: ${receiptNumber}`);
      }
    }

    // Send email receipt
    if (config.receipt_email_enabled === 'true') {
      const gmailUser = config.billing_gmail_user;
      const gmailPassword = config.billing_gmail_password;
      const senderName = config.billing_sender_name || '';
      
      if (gmailUser && gmailPassword && cliente.email) {
        // Generate professional HTML email
        const emailHtml = generateProfessionalEmailHTML(cliente, paymentDate, cliente.data_renovacao, companyName, receiptNumber);
        const emailSubject = `✅ Recibo de Pagamento - ${cliente.produto}`;
        
        const emailResult = await sendEmailViaSMTP(gmailUser, gmailPassword, senderName, cliente.email, emailSubject, emailHtml);
        results.email.sent = emailResult.success;
        results.email.error = emailResult.error || null;
        
        // Log the result
        await supabase.from('billing_logs').insert({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_email: cliente.email,
          cliente_numero: cliente.numero,
          message_type: 'recibo',
          channel: 'email',
          status: emailResult.success ? 'sent' : 'error',
          error_message: emailResult.error,
          message_body: emailHtml,
        });
      } else {
        console.log(`⚠️ Email não enviado - credenciais ou email do cliente ausentes`);
        results.email.error = 'Credenciais Gmail ou email do cliente não configurados';
      }
    }

    // Send WhatsApp receipt
    if (config.receipt_whatsapp_enabled === 'true') {
      // Fetch active WhatsApp instance
      const { data: instances } = await supabase
        .from('billing_whatsapp_instances')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      const instance = instances?.[0];
      
      if (instance && cliente.numero) {
        // Generate professional WhatsApp message
        const whatsappMessage = generateProfessionalWhatsAppMessage(cliente, paymentDate, cliente.data_renovacao, companyName, receiptNumber);
        
        const whatsappResult = await sendWhatsAppMessage(
          instance.api_url,
          instance.api_key,
          instance.instance_name,
          cliente.numero,
          whatsappMessage
        );
        
        results.whatsapp.sent = whatsappResult.success;
        results.whatsapp.error = whatsappResult.error || null;
        
        // Update last used timestamp
        if (whatsappResult.success) {
          await supabase
            .from('billing_whatsapp_instances')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', instance.id);
        }
        
        // Log the result
        await supabase.from('billing_logs').insert({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_email: cliente.email,
          cliente_numero: cliente.numero,
          message_type: 'recibo',
          channel: 'whatsapp',
          status: whatsappResult.success ? 'sent' : 'error',
          error_message: whatsappResult.error,
        });
      } else {
        console.log(`⚠️ WhatsApp não enviado - instância ou número do cliente ausentes`);
        results.whatsapp.error = 'Instância WhatsApp ou número do cliente não configurados';
      }
    }

    console.log(`\n📊 Resultado do envio de recibo:`);
    console.log(`   Email: ${results.email.sent ? '✅ Enviado' : '❌ Não enviado'} ${results.email.error ? `(${results.email.error})` : ''}`);
    console.log(`   WhatsApp: ${results.whatsapp.sent ? '✅ Enviado' : '❌ Não enviado'} ${results.whatsapp.error ? `(${results.whatsapp.error})` : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        receiptNumber,
        cliente: {
          nome: cliente.nome,
          email: cliente.email,
          numero: cliente.numero,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro ao processar recibo:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
