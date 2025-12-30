import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const formatMessage = (template: string, cliente: Cliente, paidAt: string, nextRenewal: string): string => {
  const currencySymbol = cliente.moeda === 'USD' ? '$' : 'R$';
  const formattedValue = `${currencySymbol} ${cliente.valor.toFixed(2)}`;
  const paidDate = new Date(paidAt).toLocaleDateString('pt-BR');
  const renewalDate = new Date(nextRenewal).toLocaleDateString('pt-BR');
  
  return template
    .replace(/{nome}/g, cliente.nome)
    .replace(/{email}/g, cliente.email)
    .replace(/{cpf}/g, cliente.cpf)
    .replace(/{produto}/g, cliente.produto)
    .replace(/{plano}/g, cliente.plano || 'N/A')
    .replace(/{valor}/g, formattedValue)
    .replace(/{data_pagamento}/g, paidDate)
    .replace(/{proxima_renovacao}/g, renewalDate);
};

const sendEmailViaSMTP = async (
  gmailUser: string,
  gmailPassword: string,
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

    await client.send({
      from: gmailUser,
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
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: message,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`❌ Erro WhatsApp (${response.status}):`, responseText);
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    console.log(`✅ WhatsApp de recibo enviado com sucesso para: ${cleanNumber}`);
    return { success: true };
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
    const results = {
      email: { sent: false, error: null as string | null },
      whatsapp: { sent: false, error: null as string | null },
    };

    // Send email receipt
    if (config.receipt_email_enabled === 'true') {
      const gmailUser = config.billing_gmail_user;
      const gmailPassword = config.billing_gmail_password;
      
      if (gmailUser && gmailPassword && cliente.email) {
        const emailTemplate = config.receipt_email_template || '';
        const emailSubject = formatMessage(config.receipt_email_subject || 'Recibo de Pagamento', cliente, paymentDate, cliente.data_renovacao);
        const emailBody = formatMessage(emailTemplate, cliente, paymentDate, cliente.data_renovacao);
        
        const emailResult = await sendEmailViaSMTP(gmailUser, gmailPassword, cliente.email, emailSubject, emailBody);
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
        const whatsappTemplate = config.receipt_whatsapp_template || '';
        const whatsappMessage = formatMessage(whatsappTemplate, cliente, paymentDate, cliente.data_renovacao);
        
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
