import { createClient } from "npm:@supabase/supabase-js@2";

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

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

// Main processing function that runs in background for cron calls
async function processReminder(forceRun: boolean): Promise<{ success: boolean; message?: string; count?: number; results?: unknown[] }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`[consulta-numeros-reminder] Processing reminder (force: ${forceRun})`);

  // Get reminder config
  const { data: configData, error: configError } = await supabase
    .from('consulta_numeros_reminder_config')
    .select('*')
    .single();

  if (configError || !configData) {
    console.log('[consulta-numeros-reminder] No config found or error:', configError?.message);
    return { success: false, message: 'Config not found' };
  }

  const config = configData as ReminderConfig;

  // If it's a cron run, log that it triggered (with the exact statuses configured)
  if (!forceRun) {
    await supabase.from('consulta_numeros_reminder_logs').insert({
      channel: 'cron_check',
      status: 'triggered',
      numbers_count: 0,
      status_monitored: (config.status_to_monitor || []).join(', '),
    });
  }

  // Skip is_active check if forced
  if (!forceRun && !config.is_active) {
    console.log('[consulta-numeros-reminder] Reminders are disabled');

    // Persist a visible log so you can confirm the cron actually ran
    await supabase.from('consulta_numeros_reminder_logs').insert({
      channel: 'cron_check',
      status: 'disabled',
      numbers_count: 0,
      status_monitored: (config.status_to_monitor || []).join(', '),
    });

    return { success: true, message: 'Reminders disabled' };
  }

  if (!config.status_to_monitor || config.status_to_monitor.length === 0) {
    console.log('[consulta-numeros-reminder] No status to monitor configured');
    return { success: false, message: 'Nenhum status configurado para monitorar' };
  }

  // Skip time checks if forced
  if (!forceRun) {
    // Check current time is within operating hours (Brazil timezone)
    const now = new Date();
    const brazilOffset = -3 * 60;
    const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
    const currentHour = brazilTime.getHours();
    const currentDay = brazilTime.getDay().toString();

    // IMPORTANT: end hour is inclusive (e.g. end=19 allows 19:00)
    if (currentHour < config.cron_start_hour || currentHour > config.cron_end_hour) {
      console.log(
        `[consulta-numeros-reminder] Outside operating hours (${currentHour}h, allowed: ${config.cron_start_hour}-${config.cron_end_hour})`
      );

      await supabase.from('consulta_numeros_reminder_logs').insert({
        channel: 'cron_check',
        status: 'outside_hours',
        numbers_count: 0,
        status_monitored: (config.status_to_monitor || []).join(', '),
      });

      return { success: true, message: 'Outside operating hours' };
    }

    if (!config.cron_days.includes(currentDay)) {
      console.log(`[consulta-numeros-reminder] Not a configured day (${currentDay}, allowed: ${config.cron_days.join(',')})`);

      await supabase.from('consulta_numeros_reminder_logs').insert({
        channel: 'cron_check',
        status: 'outside_day',
        numbers_count: 0,
        status_monitored: (config.status_to_monitor || []).join(', '),
      });

      return { success: true, message: 'Not a configured day' };
    }
  }

  // Get Baserow config
  const { data: baserowConfigData } = await supabase
    .from('consulta_numeros_config')
    .select('config_key, config_value');

  if (!baserowConfigData) {
    console.log('[consulta-numeros-reminder] No Baserow config found');
    return { success: false, message: 'Baserow config not found' };
  }

  const baserowConfig: Partial<BaserowConfig> = {};
  baserowConfigData.forEach((row: { config_key: string; config_value: string }) => {
    if (row.config_key === 'baserow_api_url') baserowConfig.api_url = row.config_value;
    if (row.config_key === 'baserow_api_token') baserowConfig.api_token = row.config_value;
    if (row.config_key === 'baserow_table_id') baserowConfig.table_id = row.config_value;
  });

  if (!baserowConfig.api_url || !baserowConfig.api_token || !baserowConfig.table_id) {
    console.log('[consulta-numeros-reminder] Incomplete Baserow config');
    return { success: false, message: 'Incomplete Baserow config' };
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
  const matchingRows: { numero: string; status: string; tipo: string; isNational: boolean }[] = [];

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

  // Mapeamento enxuto de DDIs (mantemos o essencial para não pesar o cold start)
  // Obs: Brasil é tratado acima (55) e números sem DDI também caem em Brasil pelas regras de DDD.
  const countryData: Record<string, { name: string; flag: string }> = {
    '1': { name: 'Estados Unidos/Canadá', flag: '🇺🇸' },
    '33': { name: 'França', flag: '🇫🇷' },
    '34': { name: 'Espanha', flag: '🇪🇸' },
    '44': { name: 'Reino Unido', flag: '🇬🇧' },
    '49': { name: 'Alemanha', flag: '🇩🇪' },
    '54': { name: 'Argentina', flag: '🇦🇷' },
    '55': { name: 'Brasil', flag: '🇧🇷' },
    '351': { name: 'Portugal', flag: '🇵🇹' },
  };

  // Função para detectar país pelo DDI
  const getCountryByDDI = (cleanNumber: string): { name: string; flag: string } | null => {
    // Tenta DDIs de 3 dígitos primeiro, depois 2, depois 1
    for (const len of [3, 2, 1]) {
      const prefix = cleanNumber.slice(0, len);
      if (countryData[prefix]) {
        return countryData[prefix];
      }
    }
    return null;
  };

  // Function to detect if number is national (Brazil) or international
  const detectNumberType = (numero: any): { display: string; isNational: boolean } => {
    const raw = numero == null ? '' : String(numero);
    const cleanNumber = raw.replace(/\D/g, '');
    if (cleanNumber.length === 0) return { display: 'N/A', isNational: false };

    const debugId = `${cleanNumber.slice(0, 3)}…(len=${cleanNumber.length})`;

    // Brazil with DDI
    if (cleanNumber.startsWith('55')) return { display: '🇧🇷 Brasil', isNational: true };

    // Likely NANP (US/Canada): 1 + 10 digits.
    if (cleanNumber.length === 11 && cleanNumber.startsWith('1')) {
      const thirdDigit = cleanNumber.charAt(2);
      if (thirdDigit !== '9') {
        console.log(`[consulta-numeros-reminder] detectNumberType: ${debugId} => Internacional (Estados Unidos/Canadá)`);
        return { display: '🇺🇸 Estados Unidos/Canadá', isNational: false };
      }
    }

    // Tentar identificar país pelo DDI para números longos (provavelmente internacionais)
    if (cleanNumber.length > 11) {
      const country = getCountryByDDI(cleanNumber);
      if (country) {
        console.log(`[consulta-numeros-reminder] detectNumberType: ${debugId} => Internacional (${country.name})`);
        return { display: `${country.flag} ${country.name}`, isNational: country.name === 'Brasil' };
      }
    }

    // Brazil without DDI
    if (cleanNumber.length === 10) {
      const ddd = parseInt(cleanNumber.substring(0, 2), 10);
      if (ddd >= 11 && ddd <= 99) return { display: '🇧🇷 Brasil', isNational: true };
    }

    if (cleanNumber.length === 11) {
      const ddd = parseInt(cleanNumber.substring(0, 2), 10);
      const thirdDigit = cleanNumber.charAt(2);
      if (ddd >= 11 && ddd <= 99 && thirdDigit === '9') return { display: '🇧🇷 Brasil', isNational: true };
    }

    // Fallback: tentar identificar pelo DDI
    const country = getCountryByDDI(cleanNumber);
    if (country) {
      return { display: `${country.flag} ${country.name}`, isNational: country.name === 'Brasil' };
    }

    return { display: '🌍 Internacional', isNational: false };
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
      const tipoResult = detectNumberType(numero);
      matchingRows.push({ numero, status: statusValue, tipo: tipoResult.display, isNational: tipoResult.isNational });
    }
  }

  console.log(`[consulta-numeros-reminder] Monitoring statuses: ${config.status_to_monitor.join(', ')}`);
  console.log(`[consulta-numeros-reminder] Found ${matchingRows.length} numbers matching monitored statuses`);

  if (matchingRows.length === 0) {
    console.log(`[consulta-numeros-reminder] No numbers found with monitored statuses - skipping notifications`);
    
    // Log even when no numbers found (for visibility)
    await supabase.from('consulta_numeros_reminder_logs').insert({
      channel: 'cron_check',
      status: 'no_numbers',
      numbers_count: 0,
      status_monitored: config.status_to_monitor.join(', '),
    });
    
    return { 
      success: true, 
      message: 'Nenhum número encontrado com os status monitorados. Verifique se o nome do status está exatamente igual ao Baserow.',
      count: 0,
    };
  }

  // Count nationals and internationals
  const nationalsCount = matchingRows.filter(r => r.isNational).length;
  const internationalsCount = matchingRows.filter(r => !r.isNational).length;

  // Format numbers list with status and type
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
        const errorText = sanitizePII(await whatsappResponse.text());
        console.error('[consulta-numeros-reminder] WhatsApp error:', errorText);
        results.push({ channel: 'whatsapp', status: 'error', error: errorText });
        
        await supabase.from('consulta_numeros_reminder_logs').insert({
          channel: 'whatsapp',
          status: 'error',
          numbers_count: matchingRows.length,
          error_message: errorText.substring(0, 500),
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
  if (config.gmail_enabled && config.gmail_user && config.gmail_app_password && config.gmail_recipients && config.gmail_recipients.length > 0) {
    try {
      // Lazy import para reduzir o tempo de boot da função (evita timeout do cron)
      const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');

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

      const subject = config.gmail_subject_template
        .replace(/{count}/g, matchingRows.length.toString())
        .replace(/{nationals}/g, nationalsCount.toString())
        .replace(/{internationals}/g, internationalsCount.toString());

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

  return { 
    success: true, 
    count: matchingRows.length,
    results 
  };
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

    // For cron calls (no force, no action): respond immediately and process in background
    // For manual calls (force: true): wait for result
    if (!forceRun) {
      console.log('[consulta-numeros-reminder] Cron call detected - processing in background');

      // Start background processing (logs are written inside processReminder)
      EdgeRuntime.waitUntil(
        processReminder(false).catch(async (err) => {
          console.error('[consulta-numeros-reminder] Background processing error:', err);
          try {
            await supabase.from('consulta_numeros_reminder_logs').insert({
              channel: 'cron_check',
              status: 'error',
              numbers_count: 0,
              error_message: sanitizePII(String(err)).substring(0, 500),
            });
          } catch (e) {
            console.error('[consulta-numeros-reminder] Failed to write background error log:', e);
          }
        })
      );

      // Respond immediately to avoid pg_net timeout
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Processing started in background',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // For manual/test calls, wait for the result
    console.log('[consulta-numeros-reminder] Manual call detected - waiting for result');
    const result = await processReminder(true);
    
    return new Response(JSON.stringify(result), {
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
