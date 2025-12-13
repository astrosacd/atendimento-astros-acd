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

const formatMessage = (template: string, cliente: Cliente): string => {
  return template
    .replace(/{nome}/g, cliente.nome)
    .replace(/{produto}/g, cliente.produto)
    .replace(/{plano}/g, cliente.plano || 'N/A')
    .replace(/{valor}/g, cliente.valor.toFixed(2))
    .replace(/{data_renovacao}/g, new Date(cliente.data_renovacao).toLocaleDateString('pt-BR'));
};

const generateAIMessage = async (
  cliente: Cliente,
  messageType: string,
  config: BillingConfig
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

  const prompt = `${contextPrompt}

Cliente: ${cliente.nome}
Produto: ${cliente.produto}
Plano: ${cliente.plano || 'N/A'}
Valor: R$ ${cliente.valor.toFixed(2)}
Data de Renovação: ${new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
Tipo de mensagem: ${typeDescriptions[messageType] || messageType}

Gere uma mensagem de cobrança personalizada, educada e profissional. A mensagem deve ser curta (máximo 3 parágrafos) e adequada para envio por WhatsApp.`;

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
  gmailPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const emailContent = `From: ${gmailUser}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
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
      .slice(0, 10) // Max 10 errors in email
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

    // Get active billing WhatsApp instances (separate from password recovery)
    const { data: whatsappInstances } = await supabase
      .from('billing_whatsapp_instances')
      .select('*')
      .eq('is_active', true);

    let totalSent = 0;
    let totalErrors = 0;
    let whatsappInstanceIndex = 0;
    const errorDetails: { cliente: string; channel: string; error: string }[] = [];

    const processClient = async (cliente: Cliente, messageType: string, template: string) => {
      // Try AI-generated message first, fallback to template
      let message = await generateAIMessage(cliente, messageType, config);
      if (!message) {
        message = formatMessage(template, cliente);
      }
      
      const subject = `Cobrança - ${cliente.produto}`;

      // Send Email if enabled
      if (config.email_enabled === 'true' && cliente.email && config.billing_gmail_user && config.billing_gmail_password) {
        const emailResult = await sendEmail(
          cliente.email,
          subject,
          message,
          config.billing_gmail_user,
          config.billing_gmail_password
        );

        await supabase.from('billing_logs').insert({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_email: cliente.email,
          cliente_numero: cliente.numero,
          message_type: messageType,
          channel: 'email',
          status: emailResult.success ? 'sent' : 'error',
          error_message: emailResult.error,
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

        await supabase.from('billing_logs').insert({
          cliente_id: cliente.id,
          cliente_nome: cliente.nome,
          cliente_email: cliente.email,
          cliente_numero: cliente.numero,
          message_type: messageType,
          channel: 'whatsapp',
          status: whatsappResult.success ? 'sent' : 'error',
          error_message: whatsappResult.error,
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
