import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface CreateLeadRequest {
  module: 'proposals' | 'followups' | 'recovery' | 'billing' | 'agenda';
  event: string;
  lead_name: string;
  lead_phone: string;
  lead_date?: string;
  lead_produto?: string;
}

type ModuleName = CreateLeadRequest['module'];

const EVENT_ALIASES: Record<ModuleName, Record<string, string>> = {
  proposals: {
    'proposta.remarketing': 'proposta.enviada',
  },
  followups: {
    'followup.enviado': 'followup.sent',
    'followup.enviada': 'followup.sent',
    'followup.falhou': 'followup.failed',
  },
  billing: {
    'billing.d-3': 'billing.d_menos_3',
    'billing.d0': 'billing.d_zero',
    'billing.d+1': 'billing.d_mais_1',
    'billing.d+2': 'billing.d_mais_2',
    'billing.d+15': 'billing.d_mais_15',
    'billing.d+30': 'billing.d_mais_30',
  },
  recovery: {
    'recovery.novo_registro': 'recovery.registro',
    'recovery.inadimplencia': 'recovery.inadimplente',
  },
  agenda: {
    'agenda.online': 'agenda.online',
    'agenda.presencial': 'agenda.presencial',
  },
};

function getEquivalentEvents(module: ModuleName, event: string): string[] {
  const rawEvent = event.trim();
  if (!rawEvent) return [];

  const aliasMap = EVENT_ALIASES[module] ?? {};
  const canonicalEvent = aliasMap[rawEvent] ?? rawEvent;
  const aliasesForCanonical = Object.entries(aliasMap)
    .filter(([, target]) => target === canonicalEvent)
    .map(([alias]) => alias);

  return Array.from(new Set([rawEvent, canonicalEvent, ...aliasesForCanonical]));
}

function resolveEnabledEvent(module: ModuleName, event: string, enabledEvents: unknown): string | null {
  const configuredEvents = Array.isArray(enabledEvents)
    ? enabledEvents.filter((value): value is string => typeof value === 'string')
    : [];

  if (configuredEvents.length === 0) {
    return null;
  }

  const equivalentEvents = getEquivalentEvents(module, event);
  const matched = equivalentEvents.find((candidate) => configuredEvents.includes(candidate));

  return matched ?? null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CreateLeadRequest = await req.json();
    const { module, event, lead_name, lead_phone, lead_date, lead_produto } = body;

    if (!module || !event || !lead_name || !lead_phone) {
      return new Response(JSON.stringify({ error: "Missing required fields: module, event, lead_name, lead_phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate module
    if (module !== 'proposals' && module !== 'followups' && module !== 'recovery' && module !== 'billing' && module !== 'agenda') {
      return new Response(JSON.stringify({ error: "Invalid module" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📦 Baserow create-lead: module=${module}, event=${event}, name=${lead_name}`);

    // Fetch Baserow config for this module
    const { data: config, error: configError } = await supabase
      .from('baserow_integrations')
      .select('*')
      .eq('module', module)
      .single();

    if (configError || !config) {
      console.log(`⏭️ No Baserow config for module: ${module}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'No config found' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.is_enabled) {
      console.log(`⏭️ Baserow disabled for module: ${module}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'Disabled' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moduleName = module as ModuleName;

    // Check if event is enabled (supports legacy aliases per module)
    const matchedEvent = resolveEnabledEvent(moduleName, event, config.events);
    if (!matchedEvent) {
      console.log(`⏭️ Event ${event} not enabled for module: ${module}`);
      return new Response(JSON.stringify({
        skipped: true,
        reason: `Event ${event} not enabled`,
        enabled_events: Array.isArray(config.events) ? config.events : [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (matchedEvent !== event) {
      console.log(`ℹ️ Event alias resolved: ${event} -> ${matchedEvent} (module=${module})`);
    }

    if (!config.api_url || !config.api_token || !config.table_id) {
      console.error('❌ Baserow credentials incomplete');
      return new Response(JSON.stringify({ error: "Baserow credentials incomplete" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean and normalize phone number
    const cleanPhone = normalizeLeadPhone(lead_phone);
    if (!cleanPhone) {
      return new Response(JSON.stringify({ error: 'Invalid lead_phone' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateStr = lead_date || new Date().toLocaleDateString('pt-BR');

    const baseUrl = config.api_url.replace(/\/$/, '');
    const headers = {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    };

    const number1 = `${cleanPhone}@s.whatsapp.net`;
    const number2 = `+${cleanPhone}`;
    const tableFields = await resolveTableFieldNames(baseUrl, headers, config.table_id);
    const results = [];

    console.log(`📦 Baserow sync payload: ${JSON.stringify({ module, event, matchedEvent, lead_name, cleanPhone, number1, number2, tableFields })}`);

    // Process each number format: exact-match/update-or-create with retry-safe fallback
    for (const numero of [number1, number2]) {
      try {
        const existingRow = await findExistingRowExact(baseUrl, headers, config.table_id, numero);

        if (existingRow) {
          const updated = await updateAtendeHumano(baseUrl, headers, config.table_id, tableFields, existingRow.id, numero);
          results.push(updated);
          continue;
        }

        const created = await createLeadRow(baseUrl, headers, config.table_id, tableFields, lead_name, numero, dateStr);
        if (created.success) {
          results.push(created);
          continue;
        }

        // Fallback for race conditions / duplicate constraints:
        // try searching again and updating if the row appeared between search and create.
        const recoveredRow = await findExistingRowExact(baseUrl, headers, config.table_id, numero);
        if (recoveredRow) {
          const recovered = await updateAtendeHumano(baseUrl, headers, config.table_id, tableFields, recoveredRow.id, numero);
          results.push({ ...recovered, action: 'updated_after_create_conflict' });
        } else {
          results.push(created);
        }
      } catch (err: any) {
        console.error(`❌ Baserow error for ${numero}:`, err.message);
        results.push({ numero, action: 'error', success: false, error: err.message });
      }
    }

    const hasAnySuccess = results.some((r: any) => r.success === true);
    const hasAnyFailure = results.some((r: any) => r.success === false);

    if (hasAnyFailure && !hasAnySuccess) {
      return new Response(JSON.stringify({ success: false, results }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hasAnyFailure) {
      return new Response(JSON.stringify({ success: true, partial_failure: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('❌ General error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizeLeadPhone(value: string): string {
  let digits = value.replace(/\D/g, '');

  if (!digits) return '';

  // Common international prefix variant (e.g. 0055...)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Default BR country code when only local mobile/landline digits were provided
  // (10 or 11 digits, e.g. 11987654321 -> 5511987654321)
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }

  return digits;
}

type NumberSignature = {
  kind: 'whatsapp_net' | 'plus_or_plain' | 'unknown';
  digits: string;
  raw: string;
};

function toNumberSignature(value: string | null | undefined): NumberSignature {
  const raw = (value ?? '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return { kind: 'unknown', digits: '', raw };
  }

  if (lower.endsWith('@s.whatsapp.net')) {
    const digits = lower.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    return { kind: 'whatsapp_net', digits, raw };
  }

  const digits = raw.replace(/\D/g, '');
  return { kind: 'plus_or_plain', digits, raw };
}

function getComparableDigitVariants(digits: string): string[] {
  if (!digits) return [];

  const variants = new Set<string>([digits]);

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    variants.add(digits.slice(2));
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    variants.add(`55${digits}`);
  }

  return Array.from(variants);
}

function numbersEquivalent(target: string, candidate: string): boolean {
  const t = toNumberSignature(target);
  const c = toNumberSignature(candidate);

  // Keep formats separated to preserve business rule:
  // @s.whatsapp.net and +number are treated as distinct records.
  if (t.kind !== c.kind) return false;

  if (t.digits && c.digits) {
    const targetVariants = new Set(getComparableDigitVariants(t.digits));
    return getComparableDigitVariants(c.digits).some((value) => targetVariants.has(value));
  }

  return t.raw === c.raw;
}

function normalizeFieldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .trim();
}

type TableFieldNames = {
  nameField: string;
  numeroField: string;
  dateField: string;
  humanField: string;
};

function findFieldName(keys: string[], aliases: string[], fallback: string): string {
  const aliasSet = new Set(aliases.map((alias) => normalizeFieldName(alias)));
  const matched = keys.find((key) => aliasSet.has(normalizeFieldName(key)));
  return matched ?? fallback;
}

function getRowNumeroValue(row: Record<string, any>): string {
  for (const [key, value] of Object.entries(row)) {
    if (normalizeFieldName(key) === 'numero' && typeof value === 'string') {
      return value;
    }
  }

  return '';
}

function getSearchCandidates(numero: string): string[] {
  const signature = toNumberSignature(numero);
  const raw = signature.raw ? [signature.raw] : [];

  if (!signature.digits) {
    return raw;
  }

  const digitVariants = getComparableDigitVariants(signature.digits);

  if (signature.kind === 'whatsapp_net') {
    return Array.from(new Set([
      ...raw,
      ...digitVariants.map((digits) => `${digits}@s.whatsapp.net`),
    ]));
  }

  return Array.from(new Set([
    ...raw,
    ...digitVariants,
    ...digitVariants.map((digits) => `+${digits}`),
  ]));
}

async function fetchWithRetry(url: string, init: RequestInit, label: string, maxAttempts = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.ok || (response.status !== 429 && response.status < 500) || attempt === maxAttempts) {
        return response;
      }

      const bodyPreview = await response.text().catch(() => '');
      console.warn(`⚠️ ${label} retry ${attempt}/${maxAttempts} -> HTTP ${response.status}: ${bodyPreview}`);
    } catch (error: any) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.warn(`⚠️ ${label} retry ${attempt}/${maxAttempts} -> ${error?.message || 'unknown error'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 300));
  }

  throw new Error(`${label} failed after ${maxAttempts} attempts`);
}

async function resolveTableFieldNames(
  baseUrl: string,
  headers: Record<string, string>,
  tableId: string,
): Promise<TableFieldNames> {
  const previewUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=1&page=1`;
  const response = await fetchWithRetry(previewUrl, { method: 'GET', headers }, 'resolve_table_fields');
  const data = await response.json().catch(() => ({}));
  const sampleRow = Array.isArray(data?.results) ? data.results[0] : null;
  const keys = sampleRow ? Object.keys(sampleRow) : [];

  const fields: TableFieldNames = {
    nameField: findFieldName(keys, ['name', 'nome'], 'Name'),
    numeroField: findFieldName(keys, ['numero', 'número'], 'Número'),
    dateField: findFieldName(keys, ['data', 'date'], 'Data'),
    humanField: findFieldName(keys, ['AtendeHumano', 'Atende Humano', 'atende_humano'], 'AtendeHumano'),
  };

  console.log(`🧭 Baserow fields resolved for table ${tableId}: ${JSON.stringify(fields)}`);
  return fields;
}

async function findExistingRowExact(
  baseUrl: string,
  headers: Record<string, string>,
  tableId: string,
  numero: string,
): Promise<any | null> {
  const pageSize = 200;
  const maxRowsScan = 50000;
  const searchCandidates = getSearchCandidates(numero);

  // Pass 1: filtered search endpoint (faster and usually enough)
  for (const candidate of searchCandidates) {
    for (let page = 1; ; page++) {
      const searchUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&search=${encodeURIComponent(candidate)}&size=${pageSize}&page=${page}`;
      console.log(`🔍 Baserow search URL: ${searchUrl}`);

      const searchResp = await fetchWithRetry(searchUrl, { method: 'GET', headers }, `search_${candidate}`);
      const searchData = await searchResp.json().catch(() => ({}));

      console.log(`🔍 Baserow search result: candidate=${candidate}, status=${searchResp.status}, count=${searchData?.count || 0}`);

      if (!searchResp.ok) break;

      const rows = Array.isArray(searchData?.results) ? searchData.results : [];
      const exact = rows.find((row: Record<string, any>) => numbersEquivalent(numero, getRowNumeroValue(row)));
      if (exact) return exact;

      const total = Number(searchData?.count ?? rows.length);
      const scanned = page * pageSize;
      if (rows.length === 0 || scanned >= total || scanned >= maxRowsScan) break;
    }
  }

  // Pass 2 (fallback): unfiltered pagination with exact compare
  // This guarantees we still find old rows even when search endpoint misses formatting variants.
  for (let page = 1; ; page++) {
    const listUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=${pageSize}&page=${page}`;
    const listResp = await fetchWithRetry(listUrl, { method: 'GET', headers }, 'list_rows');
    const listData = await listResp.json().catch(() => ({}));

    if (!listResp.ok) break;

    const rows = Array.isArray(listData?.results) ? listData.results : [];
    const exact = rows.find((row: Record<string, any>) => numbersEquivalent(numero, getRowNumeroValue(row)));
    if (exact) return exact;

    const total = Number(listData?.count ?? rows.length);
    const scanned = page * pageSize;
    if (rows.length === 0 || scanned >= total || scanned >= maxRowsScan) break;
  }

  return null;
}

async function updateAtendeHumano(
  baseUrl: string,
  headers: Record<string, string>,
  tableId: string,
  fields: TableFieldNames,
  rowId: number,
  numero: string,
): Promise<{ numero: string; action: string; success: boolean; error?: string }> {
  const updateUrl = `${baseUrl}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`;
  const payload = {
    [fields.numeroField]: numero,
    [fields.humanField]: true,
  };

  const updateResp = await fetchWithRetry(updateUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  }, 'update_row');
  const updateData = await updateResp.text();

  if (updateResp.ok) {
    console.log(`✅ Baserow row updated (${numero}) — ${fields.numeroField} synced + ${fields.humanField} = true`);
    return { numero, action: 'updated', success: true };
  }

  console.error(`❌ Baserow update error (${numero}) with payload ${JSON.stringify(payload)}: ${updateResp.status} - ${updateData}`);
  return { numero, action: 'update_failed', success: false, error: updateData };
}

async function createLeadRow(
  baseUrl: string,
  headers: Record<string, string>,
  tableId: string,
  fields: TableFieldNames,
  leadName: string,
  numero: string,
  dateStr: string,
): Promise<{ numero: string; action: string; success: boolean; error?: string }> {
  const createUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true`;
  const payload = {
    [fields.nameField]: leadName,
    [fields.numeroField]: numero,
    [fields.dateField]: dateStr,
    [fields.humanField]: true,
  };

  const createResp = await fetchWithRetry(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  }, 'create_row');

  const createData = await createResp.text();

  if (createResp.ok) {
    console.log(`✅ Baserow row created (${numero}) using fields ${JSON.stringify(fields)}`);
    return { numero, action: 'created', success: true };
  }

  console.error(`❌ Baserow create error (${numero}) with payload ${JSON.stringify(payload)}: ${createResp.status} - ${createData}`);
  return { numero, action: 'create_failed', success: false, error: createData };
}
