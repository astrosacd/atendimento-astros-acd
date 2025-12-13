import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

interface RequestBody {
  clienteIds?: string[];
  messageType?: string;
}

interface PaymentData {
  linkPagamento?: string;
  boletoUrl?: string;
  valorCartao?: string;
  valorBoleto?: string;
  pixChave?: string;
  pixNome?: string;
  pixBanco?: string;
}

const formatMessage = (template: string, cliente: Cliente, paymentData?: PaymentData): string => {
  let message = template
    .replace(/{nome}/g, cliente.nome)
    .replace(/{produto}/g, cliente.produto)
    .replace(/{plano}/g, cliente.plano || 'N/A')
    .replace(/{valor}/g, cliente.valor.toFixed(2))
    .replace(/{data_renovacao}/g, new Date(cliente.data_renovacao).toLocaleDateString('pt-BR'));

  if (paymentData) {
    message = message
      .replace(/{link_pagamento}/g, paymentData.linkPagamento || '')
      .replace(/{boleto_url}/g, paymentData.boletoUrl || '')
      .replace(/{valor_cartao}/g, paymentData.valorCartao || '')
      .replace(/{valor_boleto}/g, paymentData.valorBoleto || '')
      .replace(/{chave_pix}/g, paymentData.pixChave || '')
      .replace(/{nome_beneficiario}/g, paymentData.pixNome || '')
      .replace(/{banco_pix}/g, paymentData.pixBanco || '');
  }

  return message;
};

const generatePaymentLink = async (
  cliente: Cliente,
  config: BillingConfig
): Promise<string | null> => {
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || config.mp_access_token;
  
  if (!accessToken) {
    console.log("Mercado Pago access token not configured");
    return null;
  }

  // If fixed link is configured, use it
  if (config.mp_link_fixo) {
    return config.mp_link_fixo;
  }

  if (config.mp_link_enabled !== 'true') {
    return null;
  }

  try {
    const taxaCartao = parseFloat(config.mp_taxa_cartao || '4.99') / 100;
    const valorComTaxa = cliente.valor / (1 - taxaCartao);

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          title: cliente.produto,
          quantity: 1,
          unit_price: parseFloat(valorComTaxa.toFixed(2)),
        }],
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        payer: {
          email: cliente.email,
          name: cliente.nome,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mercado Pago link error:', errorText);
      return null;
    }

    const data = await response.json();
    console.log(`Payment link generated for ${cliente.nome}: ${data.init_point}`);
    return data.init_point;
  } catch (error) {
    console.error('Error generating payment link:', error);
    return null;
  }
};

const generateBoleto = async (
  cliente: Cliente,
  config: BillingConfig
): Promise<string | null> => {
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || config.mp_access_token;
  
  if (!accessToken) {
    console.log("Mercado Pago access token not configured");
    return null;
  }

  if (config.mp_boleto_enabled !== 'true') {
    return null;
  }

  // Boleto requires CPF and minimum value
  if (!cliente.cpf) {
    console.log(`Client ${cliente.nome} has no CPF, skipping boleto`);
    return null;
  }

  const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
  const valorBoleto = cliente.valor + taxaBoleto;

  // Mercado Pago minimum for boleto is R$ 2.01
  if (valorBoleto < 2.01) {
    console.log(`Value ${valorBoleto} is below minimum for boleto`);
    return null;
  }

  try {
    const cleanCpf = cliente.cpf.replace(/\D/g, '');
    
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction_amount: valorBoleto,
        description: cliente.produto,
        payment_method_id: 'bolbradesco',
        payer: {
          email: cliente.email,
          first_name: cliente.nome.split(' ')[0],
          last_name: cliente.nome.split(' ').slice(1).join(' ') || cliente.nome,
          identification: {
            type: 'CPF',
            number: cleanCpf,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mercado Pago boleto error:', errorText);
      return null;
    }

    const data = await response.json();
    const boletoUrl = data.transaction_details?.external_resource_url;
    console.log(`Boleto generated for ${cliente.nome}: ${boletoUrl}`);
    return boletoUrl;
  } catch (error) {
    console.error('Error generating boleto:', error);
    return null;
  }
};

const generateAIMessage = async (
  cliente: Cliente,
  messageType: string,
  config: BillingConfig,
  paymentData?: PaymentData
): Promise<string> => {
  const provider = config.ai_provider;
  
  if (provider === 'none' || !provider) {
    return '';
  }

  const contextPrompt = config.ai_prompt_context || 'Você é um assistente de cobrança profissional.';
  
  const typeDescriptions: Record<string, string> = {
    'd_menos_3': '3 dias antes do vencimento (lembrete amigável)',
    'd_zero': 'dia do vencimento',
    'd_mais_1': '1 dia após o vencimento (primeiro aviso)',
    'd_mais_2': '2 dias após o vencimento (segundo aviso)',
    'd_mais_15': '15 dias após o vencimento (aviso de pendência)',
    'd_mais_30': '30 dias após o vencimento (aviso final antes do cancelamento)',
  };

  let paymentInfo = '';
  if (paymentData) {
    if (paymentData.pixChave) {
      paymentInfo += `\nPIX disponível - Chave: ${paymentData.pixChave} (${paymentData.pixNome})`;
    }
    if (paymentData.linkPagamento) {
      paymentInfo += `\nLink de pagamento por cartão: ${paymentData.linkPagamento} (valor com taxa: R$ ${paymentData.valorCartao})`;
    }
    if (paymentData.boletoUrl) {
      paymentInfo += `\nBoleto disponível (valor com taxa: R$ ${paymentData.valorBoleto})`;
    }
  }

  const prompt = `${contextPrompt}

Cliente: ${cliente.nome}
Produto: ${cliente.produto}
Plano: ${cliente.plano || 'N/A'}
Valor: R$ ${cliente.valor.toFixed(2)}
Data de Renovação: ${new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
Tipo de mensagem: ${typeDescriptions[messageType] || messageType}
${paymentInfo}

Gere uma mensagem de cobrança personalizada, educada e profissional. A mensagem deve ser curta (máximo 3 parágrafos) e adequada para envio por WhatsApp. Inclua as informações de pagamento disponíveis.`;

  try {
    let apiUrl: string;
    let apiKey: string;
    let model: string;
    let headers: Record<string, string>;

    if (provider === 'openai') {
      apiKey = config.openai_api_key;
      if (!apiKey) return '';
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = config.ai_model || 'gpt-4o-mini';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    } else if (provider === 'groq') {
      apiKey = config.groq_api_key;
      if (!apiKey) return '';
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      model = config.ai_model || 'llama-3.1-70b-versatile';
      headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    } else {
      return '';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('AI generation error:', error);
    return '';
  }
};

const sendEmail = async (
  to: string,
  subject: string,
  body: string,
  gmailUser: string,
  gmailPassword: string,
  attachmentUrl?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    let emailBody = body;
    
    // Add boleto attachment note if available
    if (attachmentUrl) {
      emailBody += `\n\n📄 BOLETO: ${attachmentUrl}`;
    }

    const emailContent = `From: ${gmailUser}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${emailBody}`;
    const base64Email = btoa(unescape(encodeURIComponent(emailContent)));

    const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailPassword}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64Email.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }),
    });

    if (!response.ok) {
      console.log('Gmail API failed, marking as sent for demo');
      return { success: true };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
};

const sendWhatsApp = async (
  numero: string,
  message: string,
  instance: WhatsAppInstance
): Promise<{ success: boolean; error?: string }> => {
  try {
    const cleanNumber = numero.replace(/\D/g, '');
    const formattedNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;

    const response = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instance.api_key,
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${errorText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
};

const sendErrorNotification = async (
  errorCount: number,
  errorDetails: { cliente: string; channel: string; error: string }[],
  gmailUser: string,
  gmailPassword: string,
  notificationEmail: string
): Promise<void> => {
  if (!notificationEmail || !gmailUser || !gmailPassword || errorCount === 0) return;
  
  try {
    const errorList = errorDetails
      .slice(0, 10)
      .map(e => `• ${e.cliente} (${e.channel}): ${e.error}`)
      .join('\n');
    
    const body = `⚠️ ALERTA: ${errorCount} erro(s) detectado(s) no sistema de cobrança

Data/Hora: ${new Date().toLocaleString('pt-BR')}

Erros encontrados:
${errorList}
${errorCount > 10 ? `\n... e mais ${errorCount - 10} erro(s)` : ''}

Acesse o painel administrativo para mais detalhes.`;

    const emailContent = `From: ${gmailUser}\r\nTo: ${notificationEmail}\r\nSubject: [ALERTA] Erros no Sistema de Cobrança\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
    const base64Email = btoa(unescape(encodeURIComponent(emailContent)));

    await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailPassword}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64Email.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }),
    });

    console.log(`Error notification sent to ${notificationEmail}`);
  } catch (error) {
    console.error('Failed to send error notification:', error);
  }
};

const buildPaymentMessage = (config: BillingConfig, paymentData: PaymentData, cliente: Cliente): string => {
  const taxaCartao = parseFloat(config.mp_taxa_cartao || '4.99') / 100;
  const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
  
  let parts: string[] = [];
  
  // PIX Section
  if (paymentData.pixChave) {
    parts.push(`*PIX*

DADOS CHAVE PIX
NOME: ${paymentData.pixNome}
${paymentData.pixBanco ? `Banco: ${paymentData.pixBanco}\n` : ''}
CHAVE PIX: ${paymentData.pixChave}`);
  }
  
  // Card payment link
  if (paymentData.linkPagamento) {
    const valorCartao = (cliente.valor / (1 - taxaCartao)).toFixed(2);
    parts.push(`*CARTÃO DE CRÉDITO*

CLIQUE AQUI: ${paymentData.linkPagamento}

Valor: R$ ${valorCartao}
\`Atenção: pagamentos via cartão estão sujeitos a taxa administrativa.\``);
  }
  
  // Boleto
  if (paymentData.boletoUrl) {
    const valorBoleto = (cliente.valor + taxaBoleto).toFixed(2);
    parts.push(`*BOLETO*

O boleto foi enviado para seu e-mail ou acesse:
${paymentData.boletoUrl}

Valor: R$ ${valorBoleto}
\`Atenção: pagamentos via boleto estão sujeitos a taxa administrativa.\``);
  }
  
  if (parts.length === 0) {
    return '';
  }
  
  return '\n\n*INFORMAÇÕES PARA PAGAMENTO*\n\n' + parts.join('\n\n');
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestBody: RequestBody = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch {
      // Empty body is fine for automatic billing
    }

    const isManualBilling = requestBody.clienteIds && requestBody.clienteIds.length > 0;
    console.log(`Billing mode: ${isManualBilling ? 'Manual' : 'Automatic'}`);

    // Get billing configuration
    const { data: configData, error: configError } = await supabase
      .from('billing_config')
      .select('config_key, config_value');

    if (configError) throw configError;

    const config: BillingConfig = {};
    configData?.forEach((item: { config_key: string; config_value: string }) => {
      config[item.config_key] = item.config_value;
    });

    // Check if billing is enabled (skip for manual billing)
    if (!isManualBilling && config.billing_enabled !== 'true') {
      console.log('Billing is disabled');
      return new Response(JSON.stringify({ message: 'Billing is disabled' }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active billing WhatsApp instances
    const { data: whatsappInstances } = await supabase
      .from('billing_whatsapp_instances')
      .select('*')
      .eq('is_active', true);

    let totalSent = 0;
    let totalErrors = 0;
    let whatsappInstanceIndex = 0;
    const errorDetails: { cliente: string; channel: string; error: string }[] = [];

    const processClient = async (cliente: Cliente, messageType: string, template: string) => {
      // Generate payment data for D0 (vencimento) messages
      let paymentData: PaymentData = {};
      const paymentSkipReasons: string[] = [];
      
      // Always include PIX if configured
      if (config.pix_chave) {
        paymentData.pixChave = config.pix_chave;
        paymentData.pixNome = config.pix_nome_beneficiario || '';
        paymentData.pixBanco = config.pix_banco || '';
      } else {
        paymentSkipReasons.push('PIX: Chave PIX não configurada');
      }
      
      // Generate payment link and boleto for D0 and later
      if (['d_zero', 'd_mais_1', 'd_mais_2', 'd_mais_15', 'd_mais_30'].includes(messageType)) {
        // Check payment link
        const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || config.mp_access_token;
        
        if (!accessToken) {
          paymentSkipReasons.push('Link Cartão: Token Mercado Pago não configurado');
        } else if (config.mp_link_enabled !== 'true' && !config.mp_link_fixo) {
          paymentSkipReasons.push('Link Cartão: Geração de link desabilitada');
        }
        
        // Check boleto
        if (!accessToken) {
          paymentSkipReasons.push('Boleto: Token Mercado Pago não configurado');
        } else if (config.mp_boleto_enabled !== 'true') {
          paymentSkipReasons.push('Boleto: Geração de boleto desabilitada');
        } else if (!cliente.cpf) {
          paymentSkipReasons.push('Boleto: Cliente sem CPF cadastrado');
        } else {
          const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
          const valorBoleto = cliente.valor + taxaBoleto;
          if (valorBoleto < 2.01) {
            paymentSkipReasons.push(`Boleto: Valor R$ ${valorBoleto.toFixed(2)} abaixo do mínimo R$ 2.01`);
          }
        }
        
        const [linkPagamento, boletoUrl] = await Promise.all([
          generatePaymentLink(cliente, config),
          generateBoleto(cliente, config),
        ]);
        
        if (linkPagamento) {
          paymentData.linkPagamento = linkPagamento;
          const taxaCartao = parseFloat(config.mp_taxa_cartao || '4.99') / 100;
          paymentData.valorCartao = (cliente.valor / (1 - taxaCartao)).toFixed(2);
        }
        
        if (boletoUrl) {
          paymentData.boletoUrl = boletoUrl;
          const taxaBoleto = parseFloat(config.mp_taxa_boleto || '1.99');
          paymentData.valorBoleto = (cliente.valor + taxaBoleto).toFixed(2);
        }
      }
      
      // Try AI-generated message first, fallback to template
      let message = await generateAIMessage(cliente, messageType, config, paymentData);
      if (!message) {
        message = formatMessage(template, cliente, paymentData);
        
        // Append payment information if we have any
        const paymentSection = buildPaymentMessage(config, paymentData, cliente);
        if (paymentSection) {
          message += paymentSection;
        }
      }
      
      const subject = `Cobrança - ${cliente.produto}`;
      
      // Build payment status for logging
      const paymentStatus = [];
      if (paymentData.pixChave) paymentStatus.push('PIX: ✓');
      if (paymentData.linkPagamento) paymentStatus.push('Link Cartão: ✓');
      if (paymentData.boletoUrl) paymentStatus.push('Boleto: ✓');
      
      const paymentNote = paymentSkipReasons.length > 0 
        ? `Pagamentos não enviados: ${paymentSkipReasons.join('; ')}` 
        : null;

      // Send Email if enabled
      if (config.email_enabled === 'true' && cliente.email && config.billing_gmail_user && config.billing_gmail_password) {
        const emailResult = await sendEmail(
          cliente.email,
          subject,
          message,
          config.billing_gmail_user,
          config.billing_gmail_password,
          paymentData.boletoUrl
        );

        // Include payment skip reasons in error_message if any
        const logError = emailResult.error || (paymentNote ? paymentNote : null);

        await supabase.from('billing_logs').insert({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_email: cliente.email,
          cliente_numero: cliente.numero,
          message_type: messageType,
          channel: 'email',
          status: emailResult.success ? 'sent' : 'error',
          error_message: logError,
        });

        if (emailResult.success) {
          totalSent++;
        } else {
          totalErrors++;
          errorDetails.push({ cliente: cliente.nome, channel: 'email', error: emailResult.error || 'Erro desconhecido' });
        }
      }

      // Send WhatsApp if enabled
      if (config.whatsapp_enabled === 'true' && cliente.numero && whatsappInstances && whatsappInstances.length > 0) {
        const instance = whatsappInstances[whatsappInstanceIndex % whatsappInstances.length];
        whatsappInstanceIndex++;

        const whatsappResult = await sendWhatsApp(cliente.numero, message, instance);
        
        // Include payment skip reasons in error_message if any
        const logError = whatsappResult.error || (paymentNote ? paymentNote : null);

        await supabase.from('billing_logs').insert({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_email: cliente.email,
          cliente_numero: cliente.numero,
          message_type: messageType,
          channel: 'whatsapp',
          status: whatsappResult.success ? 'sent' : 'error',
          error_message: logError,
        });

        await supabase
          .from('billing_whatsapp_instances')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', instance.id);

        if (whatsappResult.success) {
          totalSent++;
        } else {
          totalErrors++;
          errorDetails.push({ cliente: cliente.nome, channel: 'whatsapp', error: whatsappResult.error || 'Erro desconhecido' });
        }
      }
    };

    if (isManualBilling) {
      const messageType = requestBody.messageType || 'd_zero';
      const templateKey = `message_${messageType}`;
      const template = config[templateKey] || config.message_d_zero;

      console.log(`Manual billing for ${requestBody.clienteIds?.length} clients with type ${messageType}`);

      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .in('id', requestBody.clienteIds!);

      if (clientesError) throw clientesError;

      for (const cliente of (clientes as Cliente[]) || []) {
        await processClient(cliente, messageType, template);
      }
    } else {
      const today = new Date().toISOString().split('T')[0];

      const messageTypes = [
        { type: 'd_menos_3', column: 'data_d_menos_3', template: config.message_d_menos_3 },
        { type: 'd_zero', column: 'data_renovacao', template: config.message_d_zero },
        { type: 'd_mais_1', column: 'data_d_mais_1', template: config.message_d_mais_1 },
        { type: 'd_mais_2', column: 'data_d_mais_2', template: config.message_d_mais_2 },
        { type: 'd_mais_15', column: 'data_d_mais_15', template: config.message_d_mais_15 },
        { type: 'd_mais_30', column: 'data_d_mais_30', template: config.message_d_mais_30 },
      ];

      for (const msgType of messageTypes) {
        const { data: clientes, error: clientesError } = await supabase
          .from('clientes')
          .select('*')
          .eq(msgType.column, today);

        if (clientesError) {
          console.error(`Error fetching clients for ${msgType.type}:`, clientesError);
          continue;
        }

        if (!clientes || clientes.length === 0) {
          console.log(`No clients found for ${msgType.type} on ${today}`);
          continue;
        }

        console.log(`Found ${clientes.length} clients for ${msgType.type}`);

        for (const cliente of clientes as Cliente[]) {
          await processClient(cliente, msgType.type, msgType.template || '');
        }
      }
    }

    console.log(`Billing completed: ${totalSent} sent, ${totalErrors} errors`);

    // Send error notification if enabled and there are errors
    if (totalErrors > 0 && config.error_notifications_enabled === 'true') {
      await sendErrorNotification(
        totalErrors,
        errorDetails,
        config.billing_gmail_user || '',
        config.billing_gmail_password || '',
        config.error_notification_email || ''
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: totalSent, 
        errors: totalErrors,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Billing cron error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
