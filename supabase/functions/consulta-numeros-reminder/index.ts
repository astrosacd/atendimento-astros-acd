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

    // Mapeamento de DDIs para siglas de países
    const ddiToCountry: Record<string, string> = {
      '1': 'US/CA',    // Estados Unidos / Canadá
      '7': 'RU',       // Rússia
      '20': 'EG',      // Egito
      '27': 'ZA',      // África do Sul
      '30': 'GR',      // Grécia
      '31': 'NL',      // Holanda
      '32': 'BE',      // Bélgica
      '33': 'FR',      // França
      '34': 'ES',      // Espanha
      '36': 'HU',      // Hungria
      '39': 'IT',      // Itália
      '40': 'RO',      // Romênia
      '41': 'CH',      // Suíça
      '43': 'AT',      // Áustria
      '44': 'GB',      // Reino Unido
      '45': 'DK',      // Dinamarca
      '46': 'SE',      // Suécia
      '47': 'NO',      // Noruega
      '48': 'PL',      // Polônia
      '49': 'DE',      // Alemanha
      '51': 'PE',      // Peru
      '52': 'MX',      // México
      '53': 'CU',      // Cuba
      '54': 'AR',      // Argentina
      '56': 'CL',      // Chile
      '57': 'CO',      // Colômbia
      '58': 'VE',      // Venezuela
      '60': 'MY',      // Malásia
      '61': 'AU',      // Austrália
      '62': 'ID',      // Indonésia
      '63': 'PH',      // Filipinas
      '64': 'NZ',      // Nova Zelândia
      '65': 'SG',      // Singapura
      '66': 'TH',      // Tailândia
      '81': 'JP',      // Japão
      '82': 'KR',      // Coreia do Sul
      '84': 'VN',      // Vietnã
      '86': 'CN',      // China
      '90': 'TR',      // Turquia
      '91': 'IN',      // Índia
      '92': 'PK',      // Paquistão
      '93': 'AF',      // Afeganistão
      '94': 'LK',      // Sri Lanka
      '95': 'MM',      // Mianmar
      '98': 'IR',      // Irã
      '212': 'MA',     // Marrocos
      '213': 'DZ',     // Argélia
      '216': 'TN',     // Tunísia
      '218': 'LY',     // Líbia
      '220': 'GM',     // Gâmbia
      '221': 'SN',     // Senegal
      '222': 'MR',     // Mauritânia
      '223': 'ML',     // Mali
      '224': 'GN',     // Guiné
      '225': 'CI',     // Costa do Marfim
      '226': 'BF',     // Burkina Faso
      '227': 'NE',     // Níger
      '228': 'TG',     // Togo
      '229': 'BJ',     // Benin
      '230': 'MU',     // Maurício
      '231': 'LR',     // Libéria
      '232': 'SL',     // Serra Leoa
      '233': 'GH',     // Gana
      '234': 'NG',     // Nigéria
      '235': 'TD',     // Chade
      '236': 'CF',     // República Centro-Africana
      '237': 'CM',     // Camarões
      '238': 'CV',     // Cabo Verde
      '239': 'ST',     // São Tomé e Príncipe
      '240': 'GQ',     // Guiné Equatorial
      '241': 'GA',     // Gabão
      '242': 'CG',     // Congo
      '243': 'CD',     // RD Congo
      '244': 'AO',     // Angola
      '245': 'GW',     // Guiné-Bissau
      '248': 'SC',     // Seychelles
      '249': 'SD',     // Sudão
      '250': 'RW',     // Ruanda
      '251': 'ET',     // Etiópia
      '252': 'SO',     // Somália
      '253': 'DJ',     // Djibuti
      '254': 'KE',     // Quênia
      '255': 'TZ',     // Tanzânia
      '256': 'UG',     // Uganda
      '257': 'BI',     // Burundi
      '258': 'MZ',     // Moçambique
      '260': 'ZM',     // Zâmbia
      '261': 'MG',     // Madagascar
      '262': 'RE',     // Reunião
      '263': 'ZW',     // Zimbábue
      '264': 'NA',     // Namíbia
      '265': 'MW',     // Malawi
      '266': 'LS',     // Lesoto
      '267': 'BW',     // Botsuana
      '268': 'SZ',     // Eswatini
      '269': 'KM',     // Comores
      '290': 'SH',     // Santa Helena
      '291': 'ER',     // Eritreia
      '297': 'AW',     // Aruba
      '298': 'FO',     // Ilhas Faroé
      '299': 'GL',     // Groenlândia
      '350': 'GI',     // Gibraltar
      '351': 'PT',     // Portugal
      '352': 'LU',     // Luxemburgo
      '353': 'IE',     // Irlanda
      '354': 'IS',     // Islândia
      '355': 'AL',     // Albânia
      '356': 'MT',     // Malta
      '357': 'CY',     // Chipre
      '358': 'FI',     // Finlândia
      '359': 'BG',     // Bulgária
      '370': 'LT',     // Lituânia
      '371': 'LV',     // Letônia
      '372': 'EE',     // Estônia
      '373': 'MD',     // Moldávia
      '374': 'AM',     // Armênia
      '375': 'BY',     // Bielorrússia
      '376': 'AD',     // Andorra
      '377': 'MC',     // Mônaco
      '378': 'SM',     // San Marino
      '380': 'UA',     // Ucrânia
      '381': 'RS',     // Sérvia
      '382': 'ME',     // Montenegro
      '383': 'XK',     // Kosovo
      '385': 'HR',     // Croácia
      '386': 'SI',     // Eslovênia
      '387': 'BA',     // Bósnia
      '389': 'MK',     // Macedônia do Norte
      '420': 'CZ',     // Tchéquia
      '421': 'SK',     // Eslováquia
      '423': 'LI',     // Liechtenstein
      '500': 'FK',     // Ilhas Malvinas
      '501': 'BZ',     // Belize
      '502': 'GT',     // Guatemala
      '503': 'SV',     // El Salvador
      '504': 'HN',     // Honduras
      '505': 'NI',     // Nicarágua
      '506': 'CR',     // Costa Rica
      '507': 'PA',     // Panamá
      '508': 'PM',     // Saint Pierre
      '509': 'HT',     // Haiti
      '590': 'GP',     // Guadalupe
      '591': 'BO',     // Bolívia
      '592': 'GY',     // Guiana
      '593': 'EC',     // Equador
      '594': 'GF',     // Guiana Francesa
      '595': 'PY',     // Paraguai
      '596': 'MQ',     // Martinica
      '597': 'SR',     // Suriname
      '598': 'UY',     // Uruguai
      '599': 'CW',     // Curaçao
      '670': 'TL',     // Timor-Leste
      '672': 'NF',     // Ilha Norfolk
      '673': 'BN',     // Brunei
      '674': 'NR',     // Nauru
      '675': 'PG',     // Papua Nova Guiné
      '676': 'TO',     // Tonga
      '677': 'SB',     // Ilhas Salomão
      '678': 'VU',     // Vanuatu
      '679': 'FJ',     // Fiji
      '680': 'PW',     // Palau
      '681': 'WF',     // Wallis e Futuna
      '682': 'CK',     // Ilhas Cook
      '683': 'NU',     // Niue
      '685': 'WS',     // Samoa
      '686': 'KI',     // Kiribati
      '687': 'NC',     // Nova Caledônia
      '688': 'TV',     // Tuvalu
      '689': 'PF',     // Polinésia Francesa
      '690': 'TK',     // Tokelau
      '691': 'FM',     // Micronésia
      '692': 'MH',     // Ilhas Marshall
      '850': 'KP',     // Coreia do Norte
      '852': 'HK',     // Hong Kong
      '853': 'MO',     // Macau
      '855': 'KH',     // Camboja
      '856': 'LA',     // Laos
      '880': 'BD',     // Bangladesh
      '886': 'TW',     // Taiwan
      '960': 'MV',     // Maldivas
      '961': 'LB',     // Líbano
      '962': 'JO',     // Jordânia
      '963': 'SY',     // Síria
      '964': 'IQ',     // Iraque
      '965': 'KW',     // Kuwait
      '966': 'SA',     // Arábia Saudita
      '967': 'YE',     // Iêmen
      '968': 'OM',     // Omã
      '970': 'PS',     // Palestina
      '971': 'AE',     // Emirados Árabes
      '972': 'IL',     // Israel
      '973': 'BH',     // Bahrein
      '974': 'QA',     // Catar
      '975': 'BT',     // Butão
      '976': 'MN',     // Mongólia
      '977': 'NP',     // Nepal
      '992': 'TJ',     // Tajiquistão
      '993': 'TM',     // Turcomenistão
      '994': 'AZ',     // Azerbaijão
      '995': 'GE',     // Geórgia
      '996': 'KG',     // Quirguistão
      '998': 'UZ',     // Uzbequistão
    };

    // Função para detectar país pelo DDI
    const getCountryByDDI = (cleanNumber: string): string | null => {
      // Tenta DDIs de 3 dígitos primeiro, depois 2, depois 1
      for (const len of [3, 2, 1]) {
        const prefix = cleanNumber.slice(0, len);
        if (ddiToCountry[prefix]) {
          return ddiToCountry[prefix];
        }
      }
      return null;
    };

    // Function to detect if number is national (Brazil) or international
    const detectNumberType = (numero: any): string => {
      const raw = numero == null ? '' : String(numero);
      const cleanNumber = raw.replace(/\D/g, '');
      if (cleanNumber.length === 0) return 'N/A';

      const debugId = `${cleanNumber.slice(0, 3)}…(len=${cleanNumber.length})`;

      // Brazil with DDI
      if (cleanNumber.startsWith('55')) return '🇧🇷 BR';

      // Likely NANP (US/Canada): 1 + 10 digits.
      if (cleanNumber.length === 11 && cleanNumber.startsWith('1')) {
        const thirdDigit = cleanNumber.charAt(2);
        if (thirdDigit !== '9') {
          console.log(`[consulta-numeros-reminder] detectNumberType: ${debugId} => Internacional (US/CA)`);
          return '🌍 US/CA';
        }
      }

      // Tentar identificar país pelo DDI para números longos (provavelmente internacionais)
      if (cleanNumber.length > 11) {
        const country = getCountryByDDI(cleanNumber);
        if (country) {
          console.log(`[consulta-numeros-reminder] detectNumberType: ${debugId} => Internacional (${country})`);
          return `🌍 ${country}`;
        }
      }

      // Brazil without DDI
      if (cleanNumber.length === 10) {
        const ddd = parseInt(cleanNumber.substring(0, 2), 10);
        if (ddd >= 11 && ddd <= 99) return '🇧🇷 BR';
      }

      if (cleanNumber.length === 11) {
        const ddd = parseInt(cleanNumber.substring(0, 2), 10);
        const thirdDigit = cleanNumber.charAt(2);
        if (ddd >= 11 && ddd <= 99 && thirdDigit === '9') return '🇧🇷 BR';
      }

      // Fallback: tentar identificar pelo DDI
      const country = getCountryByDDI(cleanNumber);
      if (country) {
        return `🌍 ${country}`;
      }

      return '🌍 INT';
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
