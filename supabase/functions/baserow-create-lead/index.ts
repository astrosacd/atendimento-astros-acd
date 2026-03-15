import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateLeadRequest {
  module: 'proposals' | 'followups' | 'recovery' | 'billing';
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
    if (module !== 'proposals' && module !== 'followups' && module !== 'recovery' && module !== 'billing') {
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

    const results = [];

    // Process each number format: exact-match/update-or-create with retry-safe fallback
    for (const numero of [number1, number2]) {
      try {
        const existingRow = await findExistingRowExact(baseUrl, headers, config.table_id, numero);

        if (existingRow) {
          const updated = await updateAtendeHumano(baseUrl, headers, config.table_id, existingRow.id, numero);
          results.push(updated);
          continue;
        }

        const created = await createLeadRow(baseUrl, headers, config.table_id, lead_name, numero, dateStr);
        if (created.success) {
          results.push(created);
          continue;
        }

        // Fallback for race conditions / duplicate constraints:
        // try searching again and updating if the row appeared between search and create.
        const recoveredRow = await findExistingRowExact(baseUrl, headers, config.table_id, numero);
        if (recoveredRow) {
          const recovered = await updateAtendeHumano(baseUrl, headers, config.table_id, recoveredRow.id, numero);
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

function numbersEquivalent(target: string, candidate: string): boolean {
  const t = toNumberSignature(target);
  const c = toNumberSignature(candidate);

  // Keep formats separated to preserve business rule:
  // @s.whatsapp.net and +number are treated as distinct records.
  if (t.kind !== c.kind) return false;

  if (t.digits && c.digits) {
    return t.digits === c.digits;
  }

  return t.raw === c.raw;
}

function normalizeFieldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getRowNumeroValue(row: Record<string, any>): string {
  if (typeof row['Número'] === 'string') return row['Número'];
  if (typeof row['Numero'] === 'string') return row['Numero'];

  for (const [key, value] of Object.entries(row)) {
    if (normalizeFieldName(key) === 'numero' && typeof value === 'string') {
      return value;
    }
  }

  return '';
}

async function findExistingRowExact(
  baseUrl: string,
  headers: Record<string, string>,
  tableId: string,
  numero: string,
): Promise<any | null> {
  const pageSize = 200;
  const maxPages = 10;

  // Pass 1: filtered search endpoint (faster)
  for (let page = 1; page <= maxPages; page++) {
    const searchUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&search=${encodeURIComponent(numero)}&size=${pageSize}&page=${page}`;
    console.log(`🔍 Baserow search URL: ${searchUrl}`);

    const searchResp = await fetch(searchUrl, { method: 'GET', headers });
    const searchData = await searchResp.json().catch(() => ({}));

    console.log(`🔍 Baserow search result: status=${searchResp.status}, count=${searchData?.count || 0}`);

    if (!searchResp.ok) break;

    const rows = Array.isArray(searchData?.results) ? searchData.results : [];
    const exact = rows.find((row: Record<string, any>) => numbersEquivalent(numero, getRowNumeroValue(row)));
    if (exact) return exact;

    const total = Number(searchData?.count ?? rows.length);
    if (rows.length === 0 || page * pageSize >= total) break;
  }

  // Pass 2 (fallback): unfiltered pagination with exact compare
  for (let page = 1; page <= maxPages; page++) {
    const listUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=${pageSize}&page=${page}`;
    const listResp = await fetch(listUrl, { method: 'GET', headers });
    const listData = await listResp.json().catch(() => ({}));

    if (!listResp.ok) break;

    const rows = Array.isArray(listData?.results) ? listData.results : [];
    const exact = rows.find((row: Record<string, any>) => numbersEquivalent(numero, getRowNumeroValue(row)));
    if (exact) return exact;

    const total = Number(listData?.count ?? rows.length);
    if (rows.length === 0 || page * pageSize >= total) break;
  }

  return null;
}

async function updateAtendeHumano(
  baseUrl: string,
  headers: Record<string, string>,
  tableId: string,
  rowId: number,
  numero: string,
): Promise<{ numero: string; action: string; success: boolean; error?: string }> {
  const updateUrl = `${baseUrl}/api/database/rows/table/${tableId}/${rowId}/?user_field_names=true`;
  const updateResp = await fetch(updateUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ 'Atende Humano': true }),
  });
  const updateData = await updateResp.text();

  if (updateResp.ok) {
    console.log(`✅ Baserow row updated (${numero}) — Atende Humano = true`);
    return { numero, action: 'updated', success: true };
  }

  console.error(`❌ Baserow update error: ${updateResp.status} - ${updateData}`);
  return { numero, action: 'update_failed', success: false, error: updateData };
}

async function createLeadRow(
  baseUrl: string,
  headers: Record<string, string>,
  tableId: string,
  leadName: string,
  numero: string,
  dateStr: string,
): Promise<{ numero: string; action: string; success: boolean; error?: string }> {
  const createUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true`;
  const createResp = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      'Name': leadName,
      'Número': numero,
      'Data': dateStr,
      'Atende Humano': true,
    }),
  });

  const createData = await createResp.text();

  if (createResp.ok) {
    console.log(`✅ Baserow row created (${numero})`);
    return { numero, action: 'created', success: true };
  }

  console.error(`❌ Baserow create error: ${createResp.status} - ${createData}`);
  return { numero, action: 'create_failed', success: false, error: createData };
}
