import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ReminderConfig {
  id: string;
  is_active: boolean;
  status_to_monitor: string[];
  cron_interval_hours: number;
  cron_interval_minutes: number;
  cron_start_hour: number;
  cron_start_minute: number;
  cron_end_hour: number;
  cron_end_minute: number;
  cron_days: string[];
  retry_window_minutes: number;
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

// Utility fetch with timeout to prevent hanging when Baserow is slow/down
// NOTE: We use AbortController instead of AbortSignal.timeout() for better compatibility
// and to reliably abort even during TCP connect.
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Sanitize PII from log messages
function sanitizePII(message: string): string {
  return message
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
    .replace(/\b\d{11}\b/g, '[PHONE_REDACTED]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_REDACTED]');
}

function normalizeStatusValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const candidate = (value as Record<string, unknown>).value ?? (value as Record<string, unknown>).name;
    return typeof candidate === 'string' ? candidate.trim() : '';
  }
  return '';
}

function extractReminderStatus(row: Record<string, unknown>): string {
  return (
    normalizeStatusValue(row?.excluido_da_base) ||
    normalizeStatusValue(row?.['Excluido da Base']) ||
    normalizeStatusValue(row?.['Excluída da Base']) ||
    normalizeStatusValue(row?.Excluido_Da_Base) ||
    normalizeStatusValue(row?.Status) ||
    normalizeStatusValue(row?.status)
  );
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

  // NOTE: We no longer log every cron trigger - only log when actually processing or on error
  // This prevents flooding the logs table with useless entries

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
    // Check current time is within operating hours (America/Sao_Paulo)
    // IMPORTANT: do not rely on server timezone; always compute using IANA timezone.
    const now = new Date();
    const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentHour = brazilTime.getHours();
    const currentMinute = brazilTime.getMinutes();
    const currentDay = brazilTime.getDay().toString();
    
    console.log(`[consulta-numeros-reminder] Current time in Brazil: ${currentHour}:${String(currentMinute).padStart(2,'0')}, day: ${currentDay}`);
    
    // Check if we're within the retry window (configurable, default 5 minutes)
    // This allows the cron to run every minute but only process within the configured window
    const retryWindow = config.retry_window_minutes ?? 5;
    if (currentMinute >= retryWindow) {
      console.log(`[consulta-numeros-reminder] Outside retry window (minute ${currentMinute}, only 0-${retryWindow - 1} allowed)`);
      // Don't log this to avoid flooding logs - just silently skip
      return { success: true, message: `Outside retry window (not first ${retryWindow} minutes of hour)` };
    }
    
    // Check if current hour is within allowed range
    // Handle case where window crosses midnight (e.g., 22:00 - 02:00 or 08:00 - 00:00)
    const startHour = config.cron_start_hour;
    const endHour = config.cron_end_hour;
    
    let inTimeWindow = false;
    if (endHour >= startHour) {
      // Normal window (e.g., 08:00 - 23:00)
      inTimeWindow = currentHour >= startHour && currentHour <= endHour;
    } else {
      // Window crosses midnight (e.g., 08:00 - 00:00 means 08:00-23:59 AND 00:00)
      // Or 22:00 - 06:00 means 22:00-23:59 AND 00:00-06:00
      inTimeWindow = currentHour >= startHour || currentHour <= endHour;
    }
    
    if (!inTimeWindow) {
      console.log(
        `[consulta-numeros-reminder] Outside operating hours (${currentHour}:${String(currentMinute).padStart(2,'0')}, allowed: ${startHour}:00-${endHour}:59)`
      );
      // NÃO grava log no banco: o cron roda a cada minuto e isso gerava milhares
      // de linhas inúteis (apenas console.log já dá visibilidade).
      return { success: true, message: 'Outside operating hours' };
    }

    if (!config.cron_days.includes(currentDay)) {
      console.log(`[consulta-numeros-reminder] Not a configured day (${currentDay}, allowed: ${config.cron_days.join(',')})`);
      // NÃO grava log no banco (mesmo motivo acima).
      return { success: true, message: 'Not a configured day' };
    }

    
    // Check if we already sent successfully this hour (deduplication)
    // This prevents flooding if the cron runs multiple times in the 0-4 minute window.
    // IMPORTANT: Only skip when ALL enabled channels have a success log for this hour.
    const hourStartBrazil = new Date(brazilTime);
    hourStartBrazil.setMinutes(0, 0, 0);

    // Convert "Brazil hour start" to a UTC instant.
    // We compute the current offset between system time (UTC) and brazilTime, then apply it.
    const offsetMs = now.getTime() - brazilTime.getTime();
    const hourStartUTC = new Date(hourStartBrazil.getTime() + offsetMs);

    const { data: recentLogs } = await supabase
      .from('consulta_numeros_reminder_logs')
      .select('channel, status, sent_at')
      .in('channel', ['whatsapp', 'gmail'])
      .eq('status', 'success')
      .gte('sent_at', hourStartUTC.toISOString());

    const sentChannels = new Set((recentLogs || []).map((l) => l.channel));
    const requiredChannels: string[] = [];
    if (config.whatsapp_enabled) requiredChannels.push('whatsapp');
    if (config.gmail_enabled) requiredChannels.push('gmail');

    const allDone = requiredChannels.length > 0 && requiredChannels.every((ch) => sentChannels.has(ch));

    if (allDone) {
      console.log(
        `[consulta-numeros-reminder] Already sent this hour for all enabled channels (${requiredChannels.join(', ')})`
      );
      return { success: true, message: 'Already sent this hour' };
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

  // Try to fetch live data from Baserow first (for real-time accuracy)
  // but fallback to local cache if Baserow is slow/down.
  // Important: fetch ALL pages. The reminder statuses can be on later Baserow pages;
  // fetching only the first page makes "Rodar agora" report zero numbers even when
  // the cache/full sync contains matching rows.
  let allRows: any[] = [];
  let usedSource = 'cache';

  try {
    const pageSize = 200;
    let page = 1;
    let hasMore = true;
    const startedAt = Date.now();

    while (hasMore) {
      if (Date.now() - startedAt > 22000) {
        console.warn('[consulta-numeros-reminder] Live Baserow fetch approaching runtime limit, stopping pagination');
        break;
      }

      const rowsUrl = new URL(`${baserowConfig.api_url.replace(/\/+$/, '')}/api/database/rows/table/${baserowConfig.table_id}/`);
      rowsUrl.searchParams.set('user_field_names', 'true');
      rowsUrl.searchParams.set('page', String(page));
      rowsUrl.searchParams.set('size', String(pageSize));

      const rowsResp = await fetchWithTimeout(
        rowsUrl.toString(),
        {
          headers: {
            'Authorization': `Token ${baserowConfig.api_token}`,
            'Content-Type': 'application/json',
          },
        },
        10000
      );

      if (!rowsResp.ok) {
        const errorText = await rowsResp.text();
        console.warn(`[consulta-numeros-reminder] Live Baserow page ${page} failed: ${rowsResp.status} ${sanitizePII(errorText).slice(0, 300)}`);
        break;
      }

      const json = await rowsResp.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      allRows.push(...results);
      hasMore = Boolean(json?.next);
      page += 1;
    }

    if (allRows.length > 0) {
      usedSource = 'baserow';
      console.log(`[consulta-numeros-reminder] Fetched ${allRows.length} rows live from Baserow`);
    }
  } catch (e: any) {
    console.warn(`[consulta-numeros-reminder] Live Baserow fetch failed (${e.message}), falling back to cache...`);
  }

  if (allRows.length === 0) {
    const { data: cacheData, error: cacheError } = await supabase
      .from('consulta_numeros_cache')
      .select('baserow_row_id, row_data')
      .limit(5000);

    if (!cacheError && cacheData) {
      allRows = cacheData.map((row: any) => ({
        id: row.baserow_row_id,
        ...row.row_data,
      }));
      usedSource = 'cache';
      console.log(`[consulta-numeros-reminder] Loaded ${allRows.length} rows from local cache`);
    }
  }

  if (allRows.length === 0) {
    console.error('[consulta-numeros-reminder] No data found in Baserow or Cache');
    return { success: false, message: 'No data found (Baserow/Cache)' };
  }

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

    // Some Baserow exports may represent single_select as a number (option id).
    // In the cache flow we don't have the option-id->label map, so we can't resolve it.
    // Returning empty avoids false matches against configured status strings.
    if (typeof s === 'number') return '';

    if (typeof s === 'object') {
      const obj: any = s;
      if (obj.value && typeof obj.value === 'string') return obj.value.trim();
      if (obj.name && typeof obj.name === 'string') return obj.name.trim();
      // If it only has an id, we cannot resolve it to a label here.
      if (obj.id != null) return '';
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
    
    // Log "nenhum número" no máximo 1x a cada 6 horas (antes era 1x por minuto,
    // o que inflava o banco com milhares de linhas repetidas).
    const seisHorasAtras = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentNoNumbers } = await supabase
      .from('consulta_numeros_reminder_logs')
      .select('id')
      .eq('channel', 'cron_check')
      .eq('status', 'no_numbers')
      .gte('sent_at', seisHorasAtras)
      .limit(1);

    if (!recentNoNumbers || recentNoNumbers.length === 0) {
      await supabase.from('consulta_numeros_reminder_logs').insert({
        channel: 'cron_check',
        status: 'no_numbers',
        numbers_count: 0,
        status_monitored: config.status_to_monitor.join(', '),
      });
    }

    
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
    // Read request body FIRST to determine action type
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Check if this is a forced/test request (skip time validations)
    const forceRun = body?.force === true || body?.forceRun === true;
    const action = body?.action as string | undefined;

    console.log(`[consulta-numeros-reminder] Starting reminder check... (force: ${forceRun}${action ? `, action: ${action}` : ''})`)

    // For cron calls (no force, no action): respond IMMEDIATELY and process in background
    // This prevents pg_net 5s timeout issues
    if (!forceRun && !action) {
      console.log('[consulta-numeros-reminder] Cron call detected - responding immediately');

      // Start background processing
      EdgeRuntime.waitUntil(
        processReminder(false).catch(async (err) => {
          console.error('[consulta-numeros-reminder] Background processing error:', err);
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabase = createClient(supabaseUrl, serviceKey);
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

      // Respond IMMEDIATELY to avoid pg_net timeout
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

    // From here on, we need Supabase client for action handlers and forced runs
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Action: manual run from the UI. Return immediately and do the heavy work in
    // the background so the browser does not hit the Supabase JS client timeout
    // ("failed to send a request to the Edge Function").
    if (action === 'run_now') {
      console.log('[consulta-numeros-reminder] Manual async run requested - responding immediately');

      EdgeRuntime.waitUntil(
        (async () => {
          await supabase.from('consulta_numeros_reminder_logs').insert({
            channel: 'cron_check',
            status: 'triggered',
            numbers_count: 0,
            status_monitored: 'Execução manual iniciada',
          });

          const result = await processReminder(true);
          if (!result.success) {
            await supabase.from('consulta_numeros_reminder_logs').insert({
              channel: 'cron_check',
              status: 'error',
              numbers_count: 0,
              error_message: sanitizePII(result.message || 'Erro ao executar lembrete manual').substring(0, 500),
            });
          }
        })().catch(async (err) => {
          console.error('[consulta-numeros-reminder] Manual background processing error:', err);
          try {
            await supabase.from('consulta_numeros_reminder_logs').insert({
              channel: 'cron_check',
              status: 'error',
              numbers_count: 0,
              error_message: sanitizePII(String(err)).substring(0, 500),
            });
          } catch (e) {
            console.error('[consulta-numeros-reminder] Failed to write manual background error log:', e);
          }
        })
      );

      return new Response(
        JSON.stringify({
          success: true,
          started: true,
          message: 'Execução iniciada em segundo plano. Acompanhe o resultado no histórico.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

      // Action: list available statuses from Baserow (field: excluido_da_base)
      // We try the "fields" metadata endpoint first because it's the "source of truth"
      // that returns all defined options even if no rows currently use them.
      let statuses: string[] = [];
      let fetchError = '';

      try {
        const fieldsUrl = `${baserowConfig.api_url}/api/database/fields/table/${baserowConfig.table_id}/`;
        const fieldsResp = await fetchWithTimeout(
          fieldsUrl,
          {
            headers: {
              'Authorization': `Token ${baserowConfig.api_token}`,
              'Content-Type': 'application/json',
            },
          },
          8000 // 8s timeout for the fields endpoint
        );

        if (fieldsResp.ok) {
          const fields = await fieldsResp.json();
          // Debugging log to see what fields are available
          console.log(`[consulta-numeros-reminder] list_statuses: Baserow returned ${fields?.length || 0} fields`);
          
          const exclField = (fields || []).find((f: any) => 
            f?.name?.toLowerCase().includes('excluido_da_base') || 
            f?.name?.toLowerCase().includes('excluido da base') ||
            f?.name?.toLowerCase().includes('excluída da base') ||
            f?.name?.toLowerCase() === 'status'
          );
          
          if (exclField) {
            console.log(`[consulta-numeros-reminder] list_statuses: found matching field "${exclField.name}" of type ${exclField.type}`);
            if (exclField.select_options) {
              statuses = exclField.select_options
                .map((o: any) => o.value)
                .filter(Boolean)
                .sort();
              console.log(`[consulta-numeros-reminder] list_statuses: found ${statuses.length} options from fields metadata`);
            } else {
              console.log(`[consulta-numeros-reminder] list_statuses: field "${exclField.name}" has no select_options (maybe not a single_select?)`);
            }
          } else {
            console.log('[consulta-numeros-reminder] list_statuses: no field matching "excluido_da_base" or similar found in metadata');
          }
        } else {
          fetchError = `Baserow fields error: ${fieldsResp.status}`;
          console.error(`[consulta-numeros-reminder] list_statuses: Baserow API returned ${fieldsResp.status}`);
        }
      } catch (e: any) {
        fetchError = `Baserow fields timeout/error: ${e.message}`;
        console.warn('[consulta-numeros-reminder] list_statuses: fields metadata fetch failed, trying fallbacks...', e.message);
      }

      // Fallback 1: Try the cache (local database)
      if (statuses.length === 0) {
        try {
          const { data: cacheRows, error: cacheError } = await supabase
            .from('consulta_numeros_cache')
            .select('row_data')
            .limit(2000);

          if (!cacheError && cacheRows && cacheRows.length > 0) {
            const set = new Set<string>();
            for (const cached of cacheRows) {
              const s = extractReminderStatus((cached as any)?.row_data || {});
              if (s) set.add(s);
            }
            statuses = Array.from(set).sort();
            console.log(`[consulta-numeros-reminder] list_statuses: found ${statuses.length} options from local cache`);
          }
        } catch (e: any) {
          console.error('[consulta-numeros-reminder] list_statuses: cache fallback failed:', e.message);
        }
      }

      // Fallback 2: Try fetching a few rows directly from Baserow
      if (statuses.length === 0) {
        try {
          const rowsUrl = `${baserowConfig.api_url}/api/database/rows/table/${baserowConfig.table_id}/?user_field_names=true&size=100`;
          const rowsResp = await fetchWithTimeout(
            rowsUrl,
            {
              headers: {
                'Authorization': `Token ${baserowConfig.api_token}`,
                'Content-Type': 'application/json',
              },
            },
            10000
          );

          if (rowsResp.ok) {
            const json = await rowsResp.json();
            const set = new Set<string>();
            for (const row of (json?.results || [])) {
              const s = extractReminderStatus(row || {});
              if (s) set.add(s);
            }
            statuses = Array.from(set).sort();
            console.log(`[consulta-numeros-reminder] list_statuses: found ${statuses.length} options from live rows`);
          }
        } catch (e: any) {
          console.error('[consulta-numeros-reminder] list_statuses: rows fallback failed:', e.message);
        }
      }

      if (statuses.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: fetchError || 'Could not find any status options. Check your Baserow table fields.',
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(`[consulta-numeros-reminder] list_statuses: found ${statuses.length} option(s)`);

      return new Response(JSON.stringify({ success: true, statuses }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For manual/test calls with force flag, wait for the result
    // For manual/test calls, wait for the result
    console.log('[consulta-numeros-reminder] Manual call detected - waiting for result');
    const result = await processReminder(true);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const msg = String(error?.message || error);
    console.error('[consulta-numeros-reminder] Unexpected error:', msg);

    // If this is a network/connect timeout to Baserow, surface as 503 (not 500)
    const isTimeoutLike = /timeout|timed out|tcp connect|connection timed out|connect/i.test(msg);
    if (isTimeoutLike) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Baserow connection timeout - server may be slow or unreachable. Try again later.',
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
