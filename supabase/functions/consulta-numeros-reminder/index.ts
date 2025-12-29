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

    // Mapeamento de DDIs para siglas e bandeiras de países
    const countryData: Record<string, { code: string; flag: string }> = {
      '1': { code: 'US/CA', flag: '🇺🇸' },    // Estados Unidos / Canadá
      '7': { code: 'RU', flag: '🇷🇺' },       // Rússia
      '20': { code: 'EG', flag: '🇪🇬' },      // Egito
      '27': { code: 'ZA', flag: '🇿🇦' },      // África do Sul
      '30': { code: 'GR', flag: '🇬🇷' },      // Grécia
      '31': { code: 'NL', flag: '🇳🇱' },      // Holanda
      '32': { code: 'BE', flag: '🇧🇪' },      // Bélgica
      '33': { code: 'FR', flag: '🇫🇷' },      // França
      '34': { code: 'ES', flag: '🇪🇸' },      // Espanha
      '36': { code: 'HU', flag: '🇭🇺' },      // Hungria
      '39': { code: 'IT', flag: '🇮🇹' },      // Itália
      '40': { code: 'RO', flag: '🇷🇴' },      // Romênia
      '41': { code: 'CH', flag: '🇨🇭' },      // Suíça
      '43': { code: 'AT', flag: '🇦🇹' },      // Áustria
      '44': { code: 'GB', flag: '🇬🇧' },      // Reino Unido
      '45': { code: 'DK', flag: '🇩🇰' },      // Dinamarca
      '46': { code: 'SE', flag: '🇸🇪' },      // Suécia
      '47': { code: 'NO', flag: '🇳🇴' },      // Noruega
      '48': { code: 'PL', flag: '🇵🇱' },      // Polônia
      '49': { code: 'DE', flag: '🇩🇪' },      // Alemanha
      '51': { code: 'PE', flag: '🇵🇪' },      // Peru
      '52': { code: 'MX', flag: '🇲🇽' },      // México
      '53': { code: 'CU', flag: '🇨🇺' },      // Cuba
      '54': { code: 'AR', flag: '🇦🇷' },      // Argentina
      '55': { code: 'BR', flag: '🇧🇷' },      // Brasil
      '56': { code: 'CL', flag: '🇨🇱' },      // Chile
      '57': { code: 'CO', flag: '🇨🇴' },      // Colômbia
      '58': { code: 'VE', flag: '🇻🇪' },      // Venezuela
      '60': { code: 'MY', flag: '🇲🇾' },      // Malásia
      '61': { code: 'AU', flag: '🇦🇺' },      // Austrália
      '62': { code: 'ID', flag: '🇮🇩' },      // Indonésia
      '63': { code: 'PH', flag: '🇵🇭' },      // Filipinas
      '64': { code: 'NZ', flag: '🇳🇿' },      // Nova Zelândia
      '65': { code: 'SG', flag: '🇸🇬' },      // Singapura
      '66': { code: 'TH', flag: '🇹🇭' },      // Tailândia
      '81': { code: 'JP', flag: '🇯🇵' },      // Japão
      '82': { code: 'KR', flag: '🇰🇷' },      // Coreia do Sul
      '84': { code: 'VN', flag: '🇻🇳' },      // Vietnã
      '86': { code: 'CN', flag: '🇨🇳' },      // China
      '90': { code: 'TR', flag: '🇹🇷' },      // Turquia
      '91': { code: 'IN', flag: '🇮🇳' },      // Índia
      '92': { code: 'PK', flag: '🇵🇰' },      // Paquistão
      '93': { code: 'AF', flag: '🇦🇫' },      // Afeganistão
      '94': { code: 'LK', flag: '🇱🇰' },      // Sri Lanka
      '95': { code: 'MM', flag: '🇲🇲' },      // Mianmar
      '98': { code: 'IR', flag: '🇮🇷' },      // Irã
      '212': { code: 'MA', flag: '🇲🇦' },     // Marrocos
      '213': { code: 'DZ', flag: '🇩🇿' },     // Argélia
      '216': { code: 'TN', flag: '🇹🇳' },     // Tunísia
      '218': { code: 'LY', flag: '🇱🇾' },     // Líbia
      '220': { code: 'GM', flag: '🇬🇲' },     // Gâmbia
      '221': { code: 'SN', flag: '🇸🇳' },     // Senegal
      '222': { code: 'MR', flag: '🇲🇷' },     // Mauritânia
      '223': { code: 'ML', flag: '🇲🇱' },     // Mali
      '224': { code: 'GN', flag: '🇬🇳' },     // Guiné
      '225': { code: 'CI', flag: '🇨🇮' },     // Costa do Marfim
      '226': { code: 'BF', flag: '🇧🇫' },     // Burkina Faso
      '227': { code: 'NE', flag: '🇳🇪' },     // Níger
      '228': { code: 'TG', flag: '🇹🇬' },     // Togo
      '229': { code: 'BJ', flag: '🇧🇯' },     // Benin
      '230': { code: 'MU', flag: '🇲🇺' },     // Maurício
      '231': { code: 'LR', flag: '🇱🇷' },     // Libéria
      '232': { code: 'SL', flag: '🇸🇱' },     // Serra Leoa
      '233': { code: 'GH', flag: '🇬🇭' },     // Gana
      '234': { code: 'NG', flag: '🇳🇬' },     // Nigéria
      '235': { code: 'TD', flag: '🇹🇩' },     // Chade
      '236': { code: 'CF', flag: '🇨🇫' },     // República Centro-Africana
      '237': { code: 'CM', flag: '🇨🇲' },     // Camarões
      '238': { code: 'CV', flag: '🇨🇻' },     // Cabo Verde
      '239': { code: 'ST', flag: '🇸🇹' },     // São Tomé e Príncipe
      '240': { code: 'GQ', flag: '🇬🇶' },     // Guiné Equatorial
      '241': { code: 'GA', flag: '🇬🇦' },     // Gabão
      '242': { code: 'CG', flag: '🇨🇬' },     // Congo
      '243': { code: 'CD', flag: '🇨🇩' },     // RD Congo
      '244': { code: 'AO', flag: '🇦🇴' },     // Angola
      '245': { code: 'GW', flag: '🇬🇼' },     // Guiné-Bissau
      '248': { code: 'SC', flag: '🇸🇨' },     // Seychelles
      '249': { code: 'SD', flag: '🇸🇩' },     // Sudão
      '250': { code: 'RW', flag: '🇷🇼' },     // Ruanda
      '251': { code: 'ET', flag: '🇪🇹' },     // Etiópia
      '252': { code: 'SO', flag: '🇸🇴' },     // Somália
      '253': { code: 'DJ', flag: '🇩🇯' },     // Djibuti
      '254': { code: 'KE', flag: '🇰🇪' },     // Quênia
      '255': { code: 'TZ', flag: '🇹🇿' },     // Tanzânia
      '256': { code: 'UG', flag: '🇺🇬' },     // Uganda
      '257': { code: 'BI', flag: '🇧🇮' },     // Burundi
      '258': { code: 'MZ', flag: '🇲🇿' },     // Moçambique
      '260': { code: 'ZM', flag: '🇿🇲' },     // Zâmbia
      '261': { code: 'MG', flag: '🇲🇬' },     // Madagascar
      '262': { code: 'RE', flag: '🇷🇪' },     // Reunião
      '263': { code: 'ZW', flag: '🇿🇼' },     // Zimbábue
      '264': { code: 'NA', flag: '🇳🇦' },     // Namíbia
      '265': { code: 'MW', flag: '🇲🇼' },     // Malawi
      '266': { code: 'LS', flag: '🇱🇸' },     // Lesoto
      '267': { code: 'BW', flag: '🇧🇼' },     // Botsuana
      '268': { code: 'SZ', flag: '🇸🇿' },     // Eswatini
      '269': { code: 'KM', flag: '🇰🇲' },     // Comores
      '290': { code: 'SH', flag: '🇸🇭' },     // Santa Helena
      '291': { code: 'ER', flag: '🇪🇷' },     // Eritreia
      '297': { code: 'AW', flag: '🇦🇼' },     // Aruba
      '298': { code: 'FO', flag: '🇫🇴' },     // Ilhas Faroé
      '299': { code: 'GL', flag: '🇬🇱' },     // Groenlândia
      '350': { code: 'GI', flag: '🇬🇮' },     // Gibraltar
      '351': { code: 'PT', flag: '🇵🇹' },     // Portugal
      '352': { code: 'LU', flag: '🇱🇺' },     // Luxemburgo
      '353': { code: 'IE', flag: '🇮🇪' },     // Irlanda
      '354': { code: 'IS', flag: '🇮🇸' },     // Islândia
      '355': { code: 'AL', flag: '🇦🇱' },     // Albânia
      '356': { code: 'MT', flag: '🇲🇹' },     // Malta
      '357': { code: 'CY', flag: '🇨🇾' },     // Chipre
      '358': { code: 'FI', flag: '🇫🇮' },     // Finlândia
      '359': { code: 'BG', flag: '🇧🇬' },     // Bulgária
      '370': { code: 'LT', flag: '🇱🇹' },     // Lituânia
      '371': { code: 'LV', flag: '🇱🇻' },     // Letônia
      '372': { code: 'EE', flag: '🇪🇪' },     // Estônia
      '373': { code: 'MD', flag: '🇲🇩' },     // Moldávia
      '374': { code: 'AM', flag: '🇦🇲' },     // Armênia
      '375': { code: 'BY', flag: '🇧🇾' },     // Bielorrússia
      '376': { code: 'AD', flag: '🇦🇩' },     // Andorra
      '377': { code: 'MC', flag: '🇲🇨' },     // Mônaco
      '378': { code: 'SM', flag: '🇸🇲' },     // San Marino
      '380': { code: 'UA', flag: '🇺🇦' },     // Ucrânia
      '381': { code: 'RS', flag: '🇷🇸' },     // Sérvia
      '382': { code: 'ME', flag: '🇲🇪' },     // Montenegro
      '383': { code: 'XK', flag: '🇽🇰' },     // Kosovo
      '385': { code: 'HR', flag: '🇭🇷' },     // Croácia
      '386': { code: 'SI', flag: '🇸🇮' },     // Eslovênia
      '387': { code: 'BA', flag: '🇧🇦' },     // Bósnia
      '389': { code: 'MK', flag: '🇲🇰' },     // Macedônia do Norte
      '420': { code: 'CZ', flag: '🇨🇿' },     // Tchéquia
      '421': { code: 'SK', flag: '🇸🇰' },     // Eslováquia
      '423': { code: 'LI', flag: '🇱🇮' },     // Liechtenstein
      '500': { code: 'FK', flag: '🇫🇰' },     // Ilhas Malvinas
      '501': { code: 'BZ', flag: '🇧🇿' },     // Belize
      '502': { code: 'GT', flag: '🇬🇹' },     // Guatemala
      '503': { code: 'SV', flag: '🇸🇻' },     // El Salvador
      '504': { code: 'HN', flag: '🇭🇳' },     // Honduras
      '505': { code: 'NI', flag: '🇳🇮' },     // Nicarágua
      '506': { code: 'CR', flag: '🇨🇷' },     // Costa Rica
      '507': { code: 'PA', flag: '🇵🇦' },     // Panamá
      '508': { code: 'PM', flag: '🇵🇲' },     // Saint Pierre
      '509': { code: 'HT', flag: '🇭🇹' },     // Haiti
      '590': { code: 'GP', flag: '🇬🇵' },     // Guadalupe
      '591': { code: 'BO', flag: '🇧🇴' },     // Bolívia
      '592': { code: 'GY', flag: '🇬🇾' },     // Guiana
      '593': { code: 'EC', flag: '🇪🇨' },     // Equador
      '594': { code: 'GF', flag: '🇬🇫' },     // Guiana Francesa
      '595': { code: 'PY', flag: '🇵🇾' },     // Paraguai
      '596': { code: 'MQ', flag: '🇲🇶' },     // Martinica
      '597': { code: 'SR', flag: '🇸🇷' },     // Suriname
      '598': { code: 'UY', flag: '🇺🇾' },     // Uruguai
      '599': { code: 'CW', flag: '🇨🇼' },     // Curaçao
      '670': { code: 'TL', flag: '🇹🇱' },     // Timor-Leste
      '672': { code: 'NF', flag: '🇳🇫' },     // Ilha Norfolk
      '673': { code: 'BN', flag: '🇧🇳' },     // Brunei
      '674': { code: 'NR', flag: '🇳🇷' },     // Nauru
      '675': { code: 'PG', flag: '🇵🇬' },     // Papua Nova Guiné
      '676': { code: 'TO', flag: '🇹🇴' },     // Tonga
      '677': { code: 'SB', flag: '🇸🇧' },     // Ilhas Salomão
      '678': { code: 'VU', flag: '🇻🇺' },     // Vanuatu
      '679': { code: 'FJ', flag: '🇫🇯' },     // Fiji
      '680': { code: 'PW', flag: '🇵🇼' },     // Palau
      '681': { code: 'WF', flag: '🇼🇫' },     // Wallis e Futuna
      '682': { code: 'CK', flag: '🇨🇰' },     // Ilhas Cook
      '683': { code: 'NU', flag: '🇳🇺' },     // Niue
      '685': { code: 'WS', flag: '🇼🇸' },     // Samoa
      '686': { code: 'KI', flag: '🇰🇮' },     // Kiribati
      '687': { code: 'NC', flag: '🇳🇨' },     // Nova Caledônia
      '688': { code: 'TV', flag: '🇹🇻' },     // Tuvalu
      '689': { code: 'PF', flag: '🇵🇫' },     // Polinésia Francesa
      '690': { code: 'TK', flag: '🇹🇰' },     // Tokelau
      '691': { code: 'FM', flag: '🇫🇲' },     // Micronésia
      '692': { code: 'MH', flag: '🇲🇭' },     // Ilhas Marshall
      '850': { code: 'KP', flag: '🇰🇵' },     // Coreia do Norte
      '852': { code: 'HK', flag: '🇭🇰' },     // Hong Kong
      '853': { code: 'MO', flag: '🇲🇴' },     // Macau
      '855': { code: 'KH', flag: '🇰🇭' },     // Camboja
      '856': { code: 'LA', flag: '🇱🇦' },     // Laos
      '880': { code: 'BD', flag: '🇧🇩' },     // Bangladesh
      '886': { code: 'TW', flag: '🇹🇼' },     // Taiwan
      '960': { code: 'MV', flag: '🇲🇻' },     // Maldivas
      '961': { code: 'LB', flag: '🇱🇧' },     // Líbano
      '962': { code: 'JO', flag: '🇯🇴' },     // Jordânia
      '963': { code: 'SY', flag: '🇸🇾' },     // Síria
      '964': { code: 'IQ', flag: '🇮🇶' },     // Iraque
      '965': { code: 'KW', flag: '🇰🇼' },     // Kuwait
      '966': { code: 'SA', flag: '🇸🇦' },     // Arábia Saudita
      '967': { code: 'YE', flag: '🇾🇪' },     // Iêmen
      '968': { code: 'OM', flag: '🇴🇲' },     // Omã
      '970': { code: 'PS', flag: '🇵🇸' },     // Palestina
      '971': { code: 'AE', flag: '🇦🇪' },     // Emirados Árabes
      '972': { code: 'IL', flag: '🇮🇱' },     // Israel
      '973': { code: 'BH', flag: '🇧🇭' },     // Bahrein
      '974': { code: 'QA', flag: '🇶🇦' },     // Catar
      '975': { code: 'BT', flag: '🇧🇹' },     // Butão
      '976': { code: 'MN', flag: '🇲🇳' },     // Mongólia
      '977': { code: 'NP', flag: '🇳🇵' },     // Nepal
      '992': { code: 'TJ', flag: '🇹🇯' },     // Tajiquistão
      '993': { code: 'TM', flag: '🇹🇲' },     // Turcomenistão
      '994': { code: 'AZ', flag: '🇦🇿' },     // Azerbaijão
      '995': { code: 'GE', flag: '🇬🇪' },     // Geórgia
      '996': { code: 'KG', flag: '🇰🇬' },     // Quirguistão
      '998': { code: 'UZ', flag: '🇺🇿' },     // Uzbequistão
    };

    // Função para detectar país pelo DDI
    const getCountryByDDI = (cleanNumber: string): { code: string; flag: string } | null => {
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
    // Returns: { display: "🇧🇷 BR", isNational: true } or { display: "🇺🇸 US/CA", isNational: false }
    const detectNumberType = (numero: any): { display: string; isNational: boolean } => {
      const raw = numero == null ? '' : String(numero);
      const cleanNumber = raw.replace(/\D/g, '');
      if (cleanNumber.length === 0) return { display: 'N/A', isNational: false };

      const debugId = `${cleanNumber.slice(0, 3)}…(len=${cleanNumber.length})`;

      // Brazil with DDI
      if (cleanNumber.startsWith('55')) return { display: '🇧🇷 BR', isNational: true };

      // Likely NANP (US/Canada): 1 + 10 digits.
      if (cleanNumber.length === 11 && cleanNumber.startsWith('1')) {
        const thirdDigit = cleanNumber.charAt(2);
        if (thirdDigit !== '9') {
          console.log(`[consulta-numeros-reminder] detectNumberType: ${debugId} => Internacional (US/CA)`);
          return { display: '🇺🇸 US/CA', isNational: false };
        }
      }

      // Tentar identificar país pelo DDI para números longos (provavelmente internacionais)
      if (cleanNumber.length > 11) {
        const country = getCountryByDDI(cleanNumber);
        if (country) {
          console.log(`[consulta-numeros-reminder] detectNumberType: ${debugId} => Internacional (${country.code})`);
          return { display: `${country.flag} ${country.code}`, isNational: country.code === 'BR' };
        }
      }

      // Brazil without DDI
      if (cleanNumber.length === 10) {
        const ddd = parseInt(cleanNumber.substring(0, 2), 10);
        if (ddd >= 11 && ddd <= 99) return { display: '🇧🇷 BR', isNational: true };
      }

      if (cleanNumber.length === 11) {
        const ddd = parseInt(cleanNumber.substring(0, 2), 10);
        const thirdDigit = cleanNumber.charAt(2);
        if (ddd >= 11 && ddd <= 99 && thirdDigit === '9') return { display: '🇧🇷 BR', isNational: true };
      }

      // Fallback: tentar identificar pelo DDI
      const country = getCountryByDDI(cleanNumber);
      if (country) {
        return { display: `${country.flag} ${country.code}`, isNational: country.code === 'BR' };
      }

      return { display: '🌍 INT', isNational: false };
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
    const nationalsCount = matchingRows.filter(r => r.isNational).length;
    const internationalsCount = matchingRows.filter(r => !r.isNational).length;

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
