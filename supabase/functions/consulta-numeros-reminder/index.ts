import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderConfig {
  id: string;
  is_active: boolean;
  status_to_monitor: string[];
  cron_interval_hours: number;
  cron_start_hour: number;
  cron_end_hour: number;
  cron_days: string[];
  whatsapp_enabled: boolean;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  whatsapp_group_id: string | null;
  whatsapp_mention_all: boolean;
  gmail_enabled: boolean;
  gmail_user: string | null;
  gmail_app_password: string | null;
  gmail_recipients: string[];
  gmail_subject_template: string;
  message_template: string;
}

interface BaserowConfig {
  api_url: string;
  api_token: string;
  table_id: string;
}

// Sanitize PII from log messages
function sanitizePII(message: string): string {
  return message
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
    .replace(/\b\d{11}\b/g, '[PHONE_REDACTED]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_REDACTED]');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if this is a forced/test request (skip time validations)
    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.force === true;
    } catch {
      // No body or invalid JSON, continue normally
    }

    console.log(`[consulta-numeros-reminder] Starting reminder check... (force: ${forceRun})`);

    // Get reminder config
    const { data: configData, error: configError } = await supabase
      .from('consulta_numeros_reminder_config')
      .select('*')
      .single();

    if (configError || !configData) {
      console.log('[consulta-numeros-reminder] No config found or error:', configError?.message);
      return new Response(JSON.stringify({ success: false, message: 'Config not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = configData as ReminderConfig;

    // Skip is_active check if forced
    if (!forceRun && !config.is_active) {
      console.log('[consulta-numeros-reminder] Reminders are disabled');
      return new Response(JSON.stringify({ success: true, message: 'Reminders disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.status_to_monitor || config.status_to_monitor.length === 0) {
      console.log('[consulta-numeros-reminder] No status to monitor configured');
      return new Response(JSON.stringify({ success: false, message: 'Nenhum status configurado para monitorar' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip time checks if forced
    if (!forceRun) {
      // Check current time is within operating hours (Brazil timezone)
      const now = new Date();
      const brazilOffset = -3 * 60;
      const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
      const currentHour = brazilTime.getHours();
      const currentDay = brazilTime.getDay().toString();

      if (currentHour < config.cron_start_hour || currentHour >= config.cron_end_hour) {
        console.log(`[consulta-numeros-reminder] Outside operating hours (${currentHour}h, allowed: ${config.cron_start_hour}-${config.cron_end_hour})`);
        return new Response(JSON.stringify({ success: true, message: 'Outside operating hours' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!config.cron_days.includes(currentDay)) {
        console.log(`[consulta-numeros-reminder] Not a configured day (${currentDay}, allowed: ${config.cron_days.join(',')})`);
        return new Response(JSON.stringify({ success: true, message: 'Not a configured day' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get Baserow config
    const { data: baserowConfigData } = await supabase
      .from('consulta_numeros_config')
      .select('config_key, config_value');

    if (!baserowConfigData) {
      console.log('[consulta-numeros-reminder] No Baserow config found');
      return new Response(JSON.stringify({ success: false, message: 'Baserow config not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baserowConfig: Partial<BaserowConfig> = {};
    baserowConfigData.forEach((row: { config_key: string; config_value: string }) => {
      if (row.config_key === 'baserow_api_url') baserowConfig.api_url = row.config_value;
      if (row.config_key === 'baserow_api_token') baserowConfig.api_token = row.config_value;
      if (row.config_key === 'baserow_table_id') baserowConfig.table_id = row.config_value;
    });

    if (!baserowConfig.api_url || !baserowConfig.api_token || !baserowConfig.table_id) {
      console.log('[consulta-numeros-reminder] Incomplete Baserow config');
      return new Response(JSON.stringify({ success: false, message: 'Incomplete Baserow config' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all rows from Baserow
    const baserowUrl = `${baserowConfig.api_url}/api/database/rows/table/${baserowConfig.table_id}/?user_field_names=true&size=200`;
    const baserowResponse = await fetch(baserowUrl, {
      headers: {
        'Authorization': `Token ${baserowConfig.api_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!baserowResponse.ok) {
      console.error('[consulta-numeros-reminder] Baserow fetch failed');
      return new Response(JSON.stringify({ success: false, message: 'Baserow fetch failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baserowData = await baserowResponse.json();
    const allRows = baserowData.results || [];

    console.log(`[consulta-numeros-reminder] Total rows from Baserow: ${allRows.length}`);
    
    // Log first row structure for debugging (without PII)
    if (allRows.length > 0) {
      const sampleRow = allRows[0];
      const fieldNames = Object.keys(sampleRow);
      console.log(`[consulta-numeros-reminder] Available fields: ${fieldNames.join(', ')}`);
    }

    // Filter rows by monitored statuses
    const matchingRows: { numero: string; status: string }[] = [];
    
    for (const row of allRows) {
      // Check multiple possible status field names
      let statusValue = '';
      
      // Try excluido_da_base field
      if (row.excluido_da_base) {
        if (typeof row.excluido_da_base === 'string') {
          statusValue = row.excluido_da_base;
        } else if (row.excluido_da_base.value) {
          statusValue = row.excluido_da_base.value;
        }
      }
      
      // Try Status field as fallback
      if (!statusValue && row.Status) {
        if (typeof row.Status === 'string') {
          statusValue = row.Status;
        } else if (row.Status.value) {
          statusValue = row.Status.value;
        }
      }
      
      // Try status (lowercase) as fallback
      if (!statusValue && row.status) {
        if (typeof row.status === 'string') {
          statusValue = row.status;
        } else if (row.status.value) {
          statusValue = row.status.value;
        }
      }

      // Log unique statuses found for debugging (only once per status)
      if (statusValue && allRows.indexOf(row) < 5) {
        console.log(`[consulta-numeros-reminder] Sample status value: "${statusValue}"`);
      }

      if (statusValue && config.status_to_monitor.includes(statusValue)) {
        const numero = row.Numero || row.numero || row.Telefone || row.telefone || 'N/A';
        matchingRows.push({ numero, status: statusValue });
      }
    }

    console.log(`[consulta-numeros-reminder] Monitoring statuses: ${config.status_to_monitor.join(', ')}`);
    console.log(`[consulta-numeros-reminder] Found ${matchingRows.length} numbers matching monitored statuses`);

    if (matchingRows.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum número encontrado com os status monitorados. Verifique se o nome do status está exatamente igual ao Baserow.',
        count: 0,
        monitoredStatuses: config.status_to_monitor
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format numbers list
    const numbersList = matchingRows.map(r => r.numero).join('\n');
    
    // Replace placeholders in message template
    const message = config.message_template
      .replace(/{count}/g, matchingRows.length.toString())
      .replace(/{numbers}/g, numbersList);

    const results: { channel: string; status: string; error?: string }[] = [];

    // Send WhatsApp notification
    if (config.whatsapp_enabled && config.evolution_api_url && config.evolution_api_key && config.evolution_instance_name && config.whatsapp_group_id) {
      try {
        const whatsappUrl = `${config.evolution_api_url}/message/sendText/${config.evolution_instance_name}`;
        
        const whatsappBody: Record<string, unknown> = {
          number: config.whatsapp_group_id,
          text: message,
        };

        if (config.whatsapp_mention_all) {
          whatsappBody.mentionsEveryOne = true;
        }

        const whatsappResponse = await fetch(whatsappUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.evolution_api_key,
          },
          body: JSON.stringify(whatsappBody),
        });

        if (whatsappResponse.ok) {
          console.log('[consulta-numeros-reminder] WhatsApp message sent successfully');
          results.push({ channel: 'whatsapp', status: 'success' });
          
          await supabase.from('consulta_numeros_reminder_logs').insert({
            channel: 'whatsapp',
            status: 'success',
            numbers_count: matchingRows.length,
            numbers_list: matchingRows.map(r => r.numero),
            status_monitored: config.status_to_monitor.join(', '),
          });
        } else {
          const errorText = await whatsappResponse.text();
          console.error('[consulta-numeros-reminder] WhatsApp send failed:', sanitizePII(errorText));
          results.push({ channel: 'whatsapp', status: 'error', error: 'Send failed' });
          
          await supabase.from('consulta_numeros_reminder_logs').insert({
            channel: 'whatsapp',
            status: 'error',
            numbers_count: matchingRows.length,
            error_message: sanitizePII(errorText).substring(0, 500),
          });
        }
      } catch (error) {
        console.error('[consulta-numeros-reminder] WhatsApp error:', error);
        results.push({ channel: 'whatsapp', status: 'error', error: String(error) });
        
        await supabase.from('consulta_numeros_reminder_logs').insert({
          channel: 'whatsapp',
          status: 'error',
          numbers_count: matchingRows.length,
          error_message: sanitizePII(String(error)).substring(0, 500),
        });
      }
    }

    // Send Gmail notification
    if (config.gmail_enabled && config.gmail_user && config.gmail_app_password && config.gmail_recipients.length > 0) {
      try {
        const client = new SMTPClient({
          connection: {
            hostname: 'smtp.gmail.com',
            port: 465,
            tls: true,
            auth: {
              username: config.gmail_user,
              password: config.gmail_app_password,
            },
          },
        });

        const subject = config.gmail_subject_template.replace(/{count}/g, matchingRows.length.toString());

        await client.send({
          from: config.gmail_user,
          to: config.gmail_recipients,
          subject,
          content: message,
          html: `<pre style="font-family: sans-serif;">${message.replace(/\n/g, '<br>')}</pre>`,
        });

        await client.close();

        console.log('[consulta-numeros-reminder] Email sent successfully');
        results.push({ channel: 'gmail', status: 'success' });
        
        await supabase.from('consulta_numeros_reminder_logs').insert({
          channel: 'gmail',
          status: 'success',
          numbers_count: matchingRows.length,
          numbers_list: matchingRows.map(r => r.numero),
          status_monitored: config.status_to_monitor.join(', '),
        });
      } catch (error) {
        console.error('[consulta-numeros-reminder] Email error:', error);
        results.push({ channel: 'gmail', status: 'error', error: String(error) });
        
        await supabase.from('consulta_numeros_reminder_logs').insert({
          channel: 'gmail',
          status: 'error',
          numbers_count: matchingRows.length,
          error_message: sanitizePII(String(error)).substring(0, 500),
        });
      }
    }

    console.log('[consulta-numeros-reminder] Completed with results:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      count: matchingRows.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[consulta-numeros-reminder] Unexpected error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
