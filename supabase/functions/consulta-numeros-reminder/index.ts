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

    // Read request body once
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Check if this is a forced/test request (skip time validations)
    const forceRun = body?.force === true;
    const action = body?.action as string | undefined;

    console.log(`[consulta-numeros-reminder] Starting reminder check... (force: ${forceRun}${action ? `, action: ${action}` : ''})`);

    // Action: list available statuses from Baserow (field: excluido_da_base)
    if (action === 'list_statuses') {
      // Get Baserow config
      const { data: baserowConfigData } = await supabase
        .from('consulta_numeros_config')
        .select('config_key, config_value');

      if (!baserowConfigData) {
        return new Response(JSON.stringify({ success: false, message: 'Baserow config not found' }), {
          status: 400,
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
        return new Response(JSON.stringify({ success: false, message: 'Incomplete Baserow config' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch fields metadata to get select options (reliable; does not depend on existing rows)
      const fieldsUrl = `${baserowConfig.api_url}/api/database/fields/table/${baserowConfig.table_id}/`;
      const fieldsResp = await fetch(fieldsUrl, {
        headers: {
          'Authorization': `Token ${baserowConfig.api_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!fieldsResp.ok) {
        const errTxt = sanitizePII(await fieldsResp.text());
        console.error('[consulta-numeros-reminder] Baserow fields fetch failed (list_statuses):', errTxt);
        return new Response(JSON.stringify({ success: false, message: 'Baserow fields fetch failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fields = await fieldsResp.json();
      const exclField = (fields || []).find((f: any) => f?.name === 'excluido_da_base');
      const options = (exclField?.select_options || []) as Array<{ id: number; value: string }>;
      const statuses = options.map((o) => o.value).filter(Boolean).sort();

      console.log(`[consulta-numeros-reminder] list_statuses: found ${statuses.length} option(s)`);

      return new Response(JSON.stringify({ success: true, statuses }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Fetch all rows from Baserow (paginate)
    const pageSize = 200;
    const maxPages = 20; // safety cap (up to 4000 rows)

    const fetchPage = async (page: number) => {
      const url = `${baserowConfig.api_url}/api/database/rows/table/${baserowConfig.table_id}/?user_field_names=true&size=${pageSize}&page=${page}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Token ${baserowConfig.api_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const errTxt = sanitizePII(await resp.text());
        console.error('[consulta-numeros-reminder] Baserow fetch failed:', errTxt);
        throw new Error('Baserow fetch failed');
      }

      return await resp.json();
    };

    // Fetch field options to map single_select ids -> values (excluido_da_base)
    const fieldsUrl = `${baserowConfig.api_url}/api/database/fields/table/${baserowConfig.table_id}/`;
    const fieldsResp = await fetch(fieldsUrl, {
      headers: {
        'Authorization': `Token ${baserowConfig.api_token}`,
        'Content-Type': 'application/json',
      },
    });

    let excluidoOptionsById: Record<string, string> = {};
    if (fieldsResp.ok) {
      try {
        const fields = await fieldsResp.json();
        const exclField = (fields || []).find((f: any) => f?.name === 'excluido_da_base');
        const options = (exclField?.select_options || []) as Array<{ id: number; value: string }>;
        excluidoOptionsById = Object.fromEntries(options.map((o) => [String(o.id), o.value]));
      } catch {
        excluidoOptionsById = {};
      }
    }

    const allRows: any[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const data = await fetchPage(page);
      const results = data?.results || [];
      allRows.push(...results);
      console.log(`[consulta-numeros-reminder] Total rows fetched so far: ${allRows.length} (page ${page})`);

      if (results.length < pageSize) break; // no more pages
    }

    console.log(`[consulta-numeros-reminder] Total rows from Baserow: ${allRows.length}`);

    // Log first row structure for debugging (without PII)
    if (allRows.length > 0) {
      const sampleRow = allRows[0];
      const fieldNames = Object.keys(sampleRow);
      console.log(`[consulta-numeros-reminder] Available fields: ${fieldNames.join(', ')}`);
    }

    // Filter rows by monitored statuses
    const matchingRows: { numero: string; status: string; tipo: string }[] = [];

    const normalizeStatus = (s: unknown): string => {
      if (!s) return '';
      if (typeof s === 'string') return s.trim();
      if (typeof s === 'number') return excluidoOptionsById[String(s)] || '';
      if (typeof s === 'object') {
        const obj: any = s;
        if (obj.value && typeof obj.value === 'string') return obj.value.trim();
        if (obj.name && typeof obj.name === 'string') return obj.name.trim();
        if (obj.id != null) return excluidoOptionsById[String(obj.id)] || '';
      }
      return '';
    };

    // Function to detect if number is national (Brazil) or international
    // Heuristic notes:
    // - If the number comes with DDI 55, it's definitely Brazilian.
    // - If it comes without DDI, we assume Brazilian format is:
    //   - 10 digits: DDD (2) + landline (8)
    //   - 11 digits: DDD (2) + mobile (9, usually starts with 9)
    // - Some international numbers (ex: US/Canada) can be 11 digits starting with country code 1,
    //   which conflicts with Brazilian DDDs 11-19. To reduce false positives:
    //   - If length is 11 and starts with '1' and the 3rd digit is NOT '9', treat as international.
    const detectNumberType = (numero: string): string => {
      const cleanNumber = (numero ?? '').replace(/\D/g, '');
      if (cleanNumber.length === 0) return 'N/A';

      // Brazil with DDI
      if (cleanNumber.startsWith('55')) return '🇧🇷 Nacional';

      // Likely NANP (US/Canada): 1 + 10 digits. Avoid misclassifying as Brazilian DDD 11-19.
      // Example provided: 15307790079 (should be international)
      if (cleanNumber.length === 11 && cleanNumber.startsWith('1')) {
        const thirdDigit = cleanNumber.charAt(2);
        if (thirdDigit !== '9') return '🌍 Internacional';
      }

      // Brazil without DDI
      if (cleanNumber.length === 10) {
        const ddd = parseInt(cleanNumber.substring(0, 2), 10);
        if (ddd >= 11 && ddd <= 99) return '🇧🇷 Nacional';
      }

      if (cleanNumber.length === 11) {
        const ddd = parseInt(cleanNumber.substring(0, 2), 10);
        const thirdDigit = cleanNumber.charAt(2);
        // Mobile in BR is typically 9 digits starting with 9 (after DDD)
        if (ddd >= 11 && ddd <= 99 && thirdDigit === '9') return '🇧🇷 Nacional';
      }

      return '🌍 Internacional';
    };

    for (const row of allRows) {
      let statusValue = '';

      // Primary: excluido_da_base (single_select)
      if (row.excluido_da_base != null) {
        statusValue = normalizeStatus(row.excluido_da_base);
      }

      // Fallbacks (kept for compatibility)
      if (!statusValue && row.Status) {
        statusValue = normalizeStatus(row.Status);
      }
      if (!statusValue && row.status) {
        statusValue = normalizeStatus(row.status);
      }

      if (statusValue && allRows.indexOf(row) < 5) {
        console.log(`[consulta-numeros-reminder] Sample status value: "${statusValue}"`);
      }

      if (statusValue && config.status_to_monitor.includes(statusValue)) {
        const numero = row.Numero || row.numero || row.Telefone || row.telefone || 'N/A';
        const tipo = detectNumberType(numero);
        matchingRows.push({ numero, status: statusValue, tipo });
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

    // Count nationals and internationals
    const nationalsCount = matchingRows.filter(r => r.tipo.includes('Nacional')).length;
    const internationalsCount = matchingRows.filter(r => r.tipo.includes('Internacional')).length;

    // Format numbers list with status and type (ex: 5585981705823 - EXCLUIDO - 🇧🇷 Nacional)
    const numbersList = matchingRows.map(r => `${r.numero} - ${r.status} - ${r.tipo}`).join('\n');
    
    // Replace placeholders in message template
    const message = config.message_template
      .replace(/{count}/g, matchingRows.length.toString())
      .replace(/{nationals}/g, nationalsCount.toString())
      .replace(/{internationals}/g, internationalsCount.toString())
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
