import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

class ExternalServiceError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ExternalServiceError';
    this.status = status;
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 25_000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ExternalServiceError('Não foi possível conectar ao Baserow (timeout).', 502);
    }
    if (String(e?.code || '').toUpperCase() === 'ETIMEDOUT' || String(e?.message || '').includes('timed out')) {
      throw new ExternalServiceError('Não foi possível conectar ao Baserow (timeout).', 502);
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}


interface BaserowConfig {
  api_url: string;
  api_token: string;
  table_id: string;
  database_id: string;
}

interface FieldMapping {
  field_name: string;
  baserow_field_id: string;
  baserow_field_name: string;
}

// Validate API key and return permissions
async function validateApiKey(supabase: any, apiKey: string) {
  const { data, error } = await supabase
    .from('consulta_numeros_api_keys')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  // Update last_used_at
  await supabase
    .from('consulta_numeros_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

// Simple in-memory cache (per edge runtime instance)
let cachedBaserowConfig: { value: BaserowConfig; cachedAt: number } | null = null;
let cachedBaserowFields: { value: any[]; cachedAt: number } | null = null;

// Get Baserow configuration
async function getBaserowConfig(supabase: any): Promise<BaserowConfig | null> {
  // 60s TTL to avoid hitting the DB on every request (and reduce transient 502s)
  if (cachedBaserowConfig && Date.now() - cachedBaserowConfig.cachedAt < 60_000) {
    return cachedBaserowConfig.value;
  }

  const fetchOnce = async () =>
    supabase.from('consulta_numeros_config').select('config_key, config_value');

  let { data, error } = await fetchOnce();

  // Retry once on transient gateway issues
  if (error) {
    console.error('Error fetching Baserow config (first try):', error);
    await new Promise((r) => setTimeout(r, 200));
    const retry = await fetchOnce();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    console.error('Error fetching Baserow config (final):', error);
    return null;
  }

  const config: any = {};
  data.forEach((row: any) => {
    config[row.config_key] = row.config_value;
  });

  if (!config.baserow_api_url || !config.baserow_api_token || !config.baserow_table_id) {
    console.error('Baserow configuration incomplete', {
      hasUrl: !!config.baserow_api_url,
      hasToken: !!config.baserow_api_token,
      hasTableId: !!config.baserow_table_id,
    });
    return null;
  }

  const normalized: BaserowConfig = {
    api_url: config.baserow_api_url,
    api_token: config.baserow_api_token,
    table_id: config.baserow_table_id,
    database_id: config.baserow_database_id || '',
  };

  cachedBaserowConfig = { value: normalized, cachedAt: Date.now() };
  return normalized;
}

// Get field mappings
async function getFieldMappings(supabase: any): Promise<FieldMapping[]> {
  const { data, error } = await supabase
    .from('consulta_numeros_field_mappings')
    .select('field_name, baserow_field_id, baserow_field_name');

  if (error) {
    console.error('Error fetching field mappings:', error);
    return [];
  }

  return data || [];
}

// Get all fields from Baserow table
async function getBaserowFields(config: BaserowConfig) {
  // 10min TTL for fields (they rarely change)
  if (cachedBaserowFields && Date.now() - cachedBaserowFields.cachedAt < 10 * 60_000) {
    return cachedBaserowFields.value;
  }

  const url = `${config.api_url}/api/database/fields/table/${config.table_id}/`;

  const inferFieldsFromSampleRow = async () => {
    // Fallback: infer columns from the row endpoint (this is what "Testar Conexão" uses).
    // This avoids hard dependency on the fields endpoint (which can be slow/timeout).
    const sampleUrl = new URL(`${config.api_url}/api/database/rows/table/${config.table_id}/`);
    sampleUrl.searchParams.set('user_field_names', 'true');
    sampleUrl.searchParams.set('size', '1');

    const res = await fetchWithTimeout(
      sampleUrl.toString(),
      {
        method: 'GET',
        headers: {
          Authorization: `Token ${config.api_token}`,
          'Content-Type': 'application/json',
        },
      },
      15_000
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error('[api-consulta-numeros] Fallback rows sample failed:', txt);
      throw new ExternalServiceError('Não foi possível conectar ao Baserow (timeout).', 502);
    }

    const json = await res.json();
    const sampleRow = (json?.results && Array.isArray(json.results) && json.results[0]) ? json.results[0] : null;

    if (!sampleRow || typeof sampleRow !== 'object') {
      // If the table is empty, we really have no way to infer. Return empty.
      return [];
    }

    const keys = Object.keys(sampleRow);
    const fieldNames = keys.filter((k) => !['id', 'order'].includes(k.toLowerCase()));

    const inferred = fieldNames.map((name, idx) => ({
      id: 900000 + idx,
      name,
      type: 'unknown',
      order: idx,
      primary: idx === 0,
      select_options: null,
    }));

    cachedBaserowFields = { value: inferred, cachedAt: Date.now() };
    return inferred;
  };

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Token ${config.api_token}`,
          'Content-Type': 'application/json',
        },
      },
      30_000
    );

    if (!response.ok) {
      const txt = await response.text();
      console.error('Error fetching Baserow fields:', txt);
      throw new ExternalServiceError('Erro ao buscar campos no Baserow.', 502);
    }

    const fields = await response.json();
    const normalized = (fields || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      order: f.order,
      primary: f.primary || false,
      select_options: f.select_options || null,
    }));

    cachedBaserowFields = { value: normalized, cachedAt: Date.now() };
    return normalized;
  } catch (e: any) {
    // If Baserow is temporarily down, serve last known fields (stale) instead of failing the whole UI.
    if (cachedBaserowFields?.value?.length) {
      console.warn('[api-consulta-numeros] Serving cached fields due to error:', String(e?.message || e));
      return cachedBaserowFields.value;
    }

    // If the fields endpoint is timing out, try a safer fallback.
    if (e?.name === 'ExternalServiceError') {
      try {
        return await inferFieldsFromSampleRow();
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    throw e;
  }
}

// No mapping needed - return data as-is from Baserow with field names
function normalizeBaserowData(rows: any[]): any[] {
  return rows.map(row => {
    const normalizedRow: any = {
      id: row.id,
      order: row.order,
    };

    // Copy all fields from Baserow
    for (const key of Object.keys(row)) {
      if (key !== 'id' && key !== 'order') {
        normalizedRow[key] = row[key];
      }
    }

    return normalizedRow;
  });
}

// Get Baserow field name from field mappings or use direct name
function getBaserowFieldName(mappings: FieldMapping[], systemFieldName: string): string {
  const mapping = mappings.find(m => m.field_name === systemFieldName);
  if (mapping) {
    return mapping.baserow_field_name;
  }
  // Return the field name directly - the user should configure mappings
  return systemFieldName;
}

// Query Baserow
async function queryBaserow(
  config: BaserowConfig,
  searchQuery: string,
  page: number = 1,
  pageSize: number = 25,
  statusFilters?: string[],
) {
  const url = new URL(`${config.api_url}/api/database/rows/table/${config.table_id}/`);
  url.searchParams.append('user_field_names', 'true');
  url.searchParams.append('page', page.toString());
  url.searchParams.append('size', pageSize.toString());

  if (searchQuery) {
    url.searchParams.append('search', searchQuery);
  }

  // Status filtering (legacy query param by field id)
  // Avoid JSON `filters=` entirely to prevent "field None" / compatibility issues.
  // IMPORTANT: if we can't reach Baserow to resolve field IDs/options, we *must not* fail the whole request.
  // In that case we simply skip the status filter and still return the base list.
  if (statusFilters && statusFilters.length > 0) {
    let fields: any[] = [];

    try {
      fields = await getBaserowFields(config);
    } catch (e: any) {
      if (e?.name === 'ExternalServiceError') {
        console.warn('[api-consulta-numeros] Skipping status filter because fields could not be loaded:', String(e?.message || e));
        fields = [];
      } else {
        throw e;
      }
    }

    if (!fields || fields.length === 0) {
      console.warn('[api-consulta-numeros] Could not fetch Baserow fields; skipping status filter');
    } else {
      const statusFieldCandidate =
        fields.find((f: any) => (f?.name || '').toLowerCase() === 'excluido_da_base') ||
        fields.find((f: any) => (f?.name || '').toLowerCase() === 'status') ||
        fields.find(
          (f: any) =>
            f?.type === 'single_select' && Array.isArray(f?.select_options) && f.select_options.length > 0
        );

      if (statusFieldCandidate && statusFieldCandidate.select_options) {
        const statusFieldId = Number.parseInt(String(statusFieldCandidate.id), 10);

        // Find the option ID by matching the status name (case-insensitive)
        const statusName = statusFilters[0];
        const matchingOption = statusFieldCandidate.select_options.find(
          (opt: any) => opt.value?.toLowerCase() === statusName?.toLowerCase()
        );

        if (Number.isFinite(statusFieldId) && matchingOption?.id) {
          if (statusFilters.length > 1) {
            console.warn(
              '[api-consulta-numeros] Multiple status filters provided; using the first one only for compatibility.',
              statusFilters
            );
          }
          console.log(`[api-consulta-numeros] Filtering by status: "${statusName}" (option ID: ${matchingOption.id})`);
          url.searchParams.set(
            `filter__field_${statusFieldId}__single_select_equal`,
            String(matchingOption.id)
          );
        } else {
          console.warn('[api-consulta-numeros] Could not find matching status option:', {
            statusName,
            availableOptions: statusFieldCandidate.select_options.map((o: any) => o.value),
          });
        }
      } else {
        console.warn('[api-consulta-numeros] Status field not found or has no options');
      }
    }
  }

  console.log('Querying Baserow:', url.toString());

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: 'GET',
      headers: {
        Authorization: `Token ${config.api_token}`,
        'Content-Type': 'application/json',
      },
    },
    15_000
  );


  if (!response.ok) {
    const errorText = await response.text();
    console.error('Baserow query error:', errorText);
    throw new Error('Erro ao consultar dados externos');
  }

  return await response.json();
}

// Get single row from Baserow
async function getBaserowRow(config: BaserowConfig, rowId: string) {
  const url = `${config.api_url}/api/database/rows/table/${config.table_id}/${rowId}/?user_field_names=true`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        Authorization: `Token ${config.api_token}`,
        'Content-Type': 'application/json',
      },
    },
    12_000
  );


  if (!response.ok) {
    const errorText = await response.text();
    console.error('Baserow get row error:', errorText);
    throw new Error('Erro ao buscar registro');
  }

  return await response.json();
}

// Update Baserow row
async function updateBaserowRow(config: BaserowConfig, rowId: string, data: any) {
  const url = `${config.api_url}/api/database/rows/table/${config.table_id}/${rowId}/?user_field_names=true`;

  console.log('Updating Baserow row:', rowId, data);

  const response = await fetchWithTimeout(
    url,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Token ${config.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
    15_000
  );


  if (!response.ok) {
    const errorText = await response.text();
    console.error('Baserow update error:', errorText);
    throw new Error('Erro ao atualizar registro');
  }

  return await response.json();
}

// Create Baserow row
async function createBaserowRow(config: BaserowConfig, data: any) {
  const url = `${config.api_url}/api/database/rows/table/${config.table_id}/?user_field_names=true`;

  console.log('Creating Baserow row:', data);

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
    15_000
  );


  if (!response.ok) {
    const errorText = await response.text();
    console.error('Baserow create error:', errorText);
    throw new Error('Erro ao criar registro');
  }

  return await response.json();
}

// Log action to history
async function logAction(
  supabase: any,
  numero: string,
  baserowRowId: string | null,
  acao: string,
  origem: string,
  dadosAnteriores: any,
  dadosNovos: any,
  camposAlterados: string[] | null,
  usuarioId: string | null,
  usuarioEmail: string | null,
  apiKeyId: string | null,
  webhookId: string | null,
  ipAddress: string | null,
  userAgent: string | null
) {
  const { error } = await supabase
    .from('consulta_numeros_history')
    .insert({
      numero,
      baserow_row_id: baserowRowId,
      acao,
      origem,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos,
      campos_alterados: camposAlterados,
      usuario_id: usuarioId,
      usuario_email: usuarioEmail,
      api_key_id: apiKeyId,
      webhook_id: webhookId,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

  if (error) {
    console.error('Error logging action:', error);
  }
}

// Trigger webhooks
async function triggerWebhooks(supabase: any, evento: string, payload: any) {
  const { data: webhooks } = await supabase
    .from('consulta_numeros_webhooks')
    .select('*')
    .eq('is_active', true)
    .contains('eventos', [evento]);

  if (!webhooks || webhooks.length === 0) return;

  for (const webhook of webhooks) {
    try {
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (webhook.secret_key) {
        headers['X-Webhook-Secret'] = webhook.secret_key;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          evento,
          timestamp: new Date().toISOString(),
          dados: payload,
        }),
      });

      await supabase
        .from('consulta_numeros_webhooks')
        .update({ last_triggered_at: new Date().toISOString() })
        .eq('id', webhook.id);
    } catch (error) {
      console.error('Webhook error:', error);
    }
  }
}

// Get available statuses from Baserow
async function getBaserowStatuses(config: BaserowConfig) {
  const url = `${config.api_url}/api/database/fields/table/${config.table_id}/`;

  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        Authorization: `Token ${config.api_token}`,
        'Content-Type': 'application/json',
      },
    },
    12_000
  );

  if (!response.ok) {
    const txt = await response.text();
    console.error('Error fetching Baserow statuses:', txt);
    throw new ExternalServiceError('Erro ao buscar status no Baserow.', 502);
  }

  const fields = await response.json();
  const statusField = (fields || []).find((f: any) => f.name === 'Status');

  if (statusField && statusField.select_options) {
    return statusField.select_options.map((opt: any) => ({
      id: opt.id,
      value: opt.value,
      color: opt.color,
    }));
  }

  return [];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Admin client for DB operations
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1] || '';

    // Get authentication
    let userId: string | null = null;
    let userEmail: string | null = null;
    let apiKeyId: string | null = null;
    let webhookId: string | null = null;
    let origem = 'painel';

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const apiKeyHeader = req.headers.get('x-api-key');

    // Check API key first
    if (apiKeyHeader) {
      const apiKeyData = await validateApiKey(supabase, apiKeyHeader);
      if (!apiKeyData) {
        return new Response(
          JSON.stringify({ success: false, error: 'API key inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      apiKeyId = apiKeyData.id;
      origem = 'api';
    } else if (authHeader) {
      // JWT is already verified by the platform (verify_jwt=true). Here we only extract user info.
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const parts = token.split('.');

      if (parts.length !== 3) {
        return new Response(
          JSON.stringify({ success: false, error: 'Autenticação inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const payloadRaw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = atob(payloadRaw.padEnd(payloadRaw.length + (4 - (payloadRaw.length % 4)) % 4, '='));
        const payload = JSON.parse(payloadJson);

        userId = payload?.sub || null;
        userEmail = payload?.email || null;

        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Autenticação inválida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('[api-consulta-numeros] Failed to parse JWT payload', { endpoint, error: String(e) });
        return new Response(
          JSON.stringify({ success: false, error: 'Autenticação inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get IP and User-Agent
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Get Baserow config
    const config = await getBaserowConfig(supabase);
    if (!config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do Baserow não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route handling
    if (req.method === 'GET') {
      // GET /campos - Get available fields from Baserow
      if (endpoint === 'campos') {
        try {
          const fields = await getBaserowFields(config);
          return new Response(
            JSON.stringify({ success: true, data: fields }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e: any) {
          if (e?.name === 'ExternalServiceError') {
            console.warn('[api-consulta-numeros] Baserow unreachable on /campos:', String(e?.message || e));
            return new Response(
              JSON.stringify({
                success: true,
                baserow_offline: true,
                warning: e?.message || 'Baserow indisponível',
                data: [],
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw e;
        }
      }

      // GET /consultar - Query numbers
      if (endpoint === 'consultar' || endpoint === 'api-consulta-numeros') {
        const searchQuery = url.searchParams.get('q') || '';
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('size') || '25');
        const statusParam = url.searchParams.get('status');
        const statusFilters = statusParam ? statusParam.split(',').filter(s => s.trim()) : undefined;

        try {
          const result = await queryBaserow(config, searchQuery, page, pageSize, statusFilters);

          // Return data directly from Baserow without transformation
          const normalizedData = normalizeBaserowData(result.results || []);

          // Log consultation
          await logAction(
            supabase,
            searchQuery || '*',
            null,
            'consulta',
            origem,
            null,
            { query: searchQuery, page, pageSize, statusFilters, resultCount: result.count },
            null,
            userId,
            userEmail,
            apiKeyId,
            webhookId,
            ipAddress,
            userAgent
          );

          return new Response(
            JSON.stringify({
              success: true,
              data: normalizedData,
              pagination: {
                count: result.count,
                page,
                pageSize,
                totalPages: Math.ceil(result.count / pageSize),
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e: any) {
          // When Baserow is temporarily unreachable, do NOT crash the UI with a 502.
          // Instead return a "soft" success with a flag the frontend can render.
          if (e?.name === 'ExternalServiceError') {
            console.warn('[api-consulta-numeros] Baserow unreachable on /consultar:', String(e?.message || e));

            return new Response(
              JSON.stringify({
                success: true,
                baserow_offline: true,
                warning: e?.message || 'Baserow indisponível',
                data: [],
                pagination: {
                  count: 0,
                  page,
                  pageSize,
                  totalPages: 0,
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          throw e;
        }
      }

      // GET /historico - Get history
      if (endpoint === 'historico') {
        const numero = url.searchParams.get('numero');
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('size') || '50');
        const offset = (page - 1) * pageSize;

        let query = supabase
          .from('consulta_numeros_history')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (numero) {
          query = query.ilike('numero', `%${numero}%`);
        }

        const { data, count, error } = await query;

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data,
            pagination: {
              count: count || 0,
              page,
              pageSize,
              totalPages: Math.ceil((count || 0) / pageSize),
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /statuses - Get available statuses
      if (endpoint === 'statuses') {
        const statuses = await getBaserowStatuses(config);
        return new Response(
          JSON.stringify({ success: true, data: statuses }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /config - Get field mappings (admin only)
      if (endpoint === 'config') {
        const mappings = await getFieldMappings(supabase);
        return new Response(
          JSON.stringify({ success: true, data: mappings }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = await req.json();
      const { row_id, ...fieldsToUpdate } = body;

      if (!row_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'row_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current data before update
      let previousData;
      try {
        previousData = await getBaserowRow(config, row_id);
      } catch (e) {
        console.error('Error getting previous data:', e);
      }

      // Build update data - accept all fields sent by frontend
      const updateData: any = {};
      const changedFields: string[] = [];

      for (const [key, value] of Object.entries(fieldsToUpdate)) {
        if (value !== undefined) {
          updateData[key] = value;
          changedFields.push(key);
        }
      }

      console.log('[api-consulta-numeros] PATCH updateData:', JSON.stringify(updateData, null, 2));

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum campo para atualizar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update in Baserow
      const updatedRow = await updateBaserowRow(config, row_id, updateData);

      // Determine action type
      let acao = 'atualizacao';
      if (changedFields.includes('status') && changedFields.includes('observacoes')) {
        acao = 'atualizacao_status_obs';
      } else if (changedFields.includes('status')) {
        acao = 'atualizacao_status';
      } else if (changedFields.includes('observacoes')) {
        acao = 'atualizacao_obs';
      }

      // Log action
      const numeroField = updatedRow['numero'] || updatedRow['Número'] || row_id;
      await logAction(
        supabase,
        numeroField,
        row_id,
        acao,
        origem,
        previousData,
        updatedRow,
        changedFields,
        userId,
        userEmail,
        apiKeyId,
        webhookId,
        ipAddress,
        userAgent
      );

      // Trigger webhooks
      await triggerWebhooks(supabase, acao, {
        numero: numeroField,
        row_id,
        changes: updateData,
        previous: previousData,
        current: updatedRow,
      });

      return new Response(
        JSON.stringify({ success: true, data: updatedRow }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /cadastrar - Create new number
    if (req.method === 'POST' && endpoint === 'cadastrar') {
      const body = await req.json();
      
      console.log('Received cadastrar body:', JSON.stringify(body, null, 2));

      // Check if body has direct fields or needs extraction
      // The frontend sends all fields directly using Baserow field names
      const createData: any = {};
      let numeroValue: string | null = null;
      let numeroFieldName: string | null = null;
      let emailValue: string | null = null;

      // Copy all fields from the request body directly to createData
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null && value !== '') {
          createData[key] = value;

          const keyLower = key.toLowerCase();

          // Track the numero field for logging - specifically look for the main "numero" field
          // Avoid matching "numero_de_compra" or other compound fields
          if (keyLower === 'numero' || keyLower === 'número') {
            numeroValue = String(value);
            numeroFieldName = key;
          }

          // Email obrigatório
          if (keyLower === 'email') {
            emailValue = String(value);
          }
        }
      }

      console.log('Create data to send to Baserow:', JSON.stringify(createData, null, 2));

      if (Object.keys(createData).length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum dado para cadastrar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!emailValue || !emailValue.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: 'E-mail é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for duplicate number before creating (EXACT match using Baserow filter)
      if (numeroValue) {
        console.log('Checking for duplicate number (exact):', numeroValue);
        try {
          const fields = await getBaserowFields(config);
          const numeroField =
            fields.find((f: any) => (f?.name || '').toLowerCase() === 'numero') ||
            fields.find((f: any) => (f?.name || '').toLowerCase() === 'número') ||
            fields.find((f: any) => (f?.name || '').toLowerCase().includes('numero') && Boolean(f?.primary));

          const numeroFieldId = Number.parseInt(String(numeroField?.id), 10);

          if (Number.isFinite(numeroFieldId)) {
            const exactUrl = new URL(`${config.api_url}/api/database/rows/table/${config.table_id}/`);
            exactUrl.searchParams.set('user_field_names', 'true');
            exactUrl.searchParams.set('size', '1');
            exactUrl.searchParams.set('page', '1');
            exactUrl.searchParams.set(`filter__field_${numeroFieldId}__equal`, String(numeroValue).trim());

            console.log('Exact duplicate check URL:', exactUrl.toString());

             const resp = await fetchWithTimeout(
               exactUrl.toString(),
               {
                 method: 'GET',
                 headers: {
                   Authorization: `Token ${config.api_token}`,
                   'Content-Type': 'application/json',
                 },
               },
               12_000
             );


            if (resp.ok) {
              const json = await resp.json();
              const found = json?.results?.[0];
              if (found) {
                console.log('Duplicate number found (exact):', found.id);
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: `Número ${numeroValue} já existe no sistema. Não é possível cadastrar números duplicados.`,
                    duplicate: true,
                    existing_row_id: found.id,
                  }),
                  { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } else {
              const errorText = await resp.text();
              console.error('Exact duplicate check failed:', errorText);
            }
          } else {
            console.warn('Could not resolve numero field id for exact duplicate check; falling back to search');

            // fallback (best-effort)
            const duplicateCheck = await queryBaserow(config, numeroValue, 1, 50);
            const exactMatch = duplicateCheck?.results?.find((row: any) => {
              const val = row?.[numeroFieldName || 'numero'] ?? row?.numero ?? row?.['Número'];
              return val !== undefined && val !== null && String(val).trim() === String(numeroValue).trim();
            });

            if (exactMatch) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: `Número ${numeroValue} já existe no sistema. Não é possível cadastrar números duplicados.`,
                  duplicate: true,
                  existing_row_id: exactMatch.id,
                }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } catch (e) {
          console.error('Error checking for duplicates (exact):', e);
          // Continue with creation if duplicate check fails
        }
      }

      // Create in Baserow
      const newRow = await createBaserowRow(config, createData);

      console.log('Baserow response:', JSON.stringify(newRow, null, 2));

      // Log action
      await logAction(
        supabase,
        numeroValue || 'N/A',
        newRow.id?.toString() || null,
        'cadastro',
        origem,
        null,
        newRow,
        Object.keys(createData),
        userId,
        userEmail,
        apiKeyId,
        webhookId,
        ipAddress,
        userAgent
      );

      // Trigger webhooks
      await triggerWebhooks(supabase, 'cadastro', {
        numero: numeroValue,
        row_id: newRow.id,
        data: newRow,
      });

      return new Response(
        JSON.stringify({ success: true, data: newRow }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /webhook - Handle incoming webhooks
    if (req.method === 'POST' && endpoint === 'webhook') {
      origem = 'webhook';
      const body = await req.json();
      
      // Validate webhook secret if provided
      const webhookSecret = req.headers.get('x-webhook-secret');
      if (webhookSecret) {
        const { data: wh } = await supabase
          .from('consulta_numeros_webhooks')
          .select('id')
          .eq('secret_key', webhookSecret)
          .single();
        
        if (wh) {
          webhookId = wh.id;
        }
      }

      const { action, row_id, numero, status, observacoes } = body;

      if (action === 'update' && row_id) {
        const updateData: any = {};
        const changedFields: string[] = [];

        if (status) {
          updateData['Status'] = status;
          changedFields.push('status');
        }
        if (observacoes) {
          updateData['Observações'] = observacoes;
          changedFields.push('observacoes');
        }

        if (Object.keys(updateData).length > 0) {
          const previousData = await getBaserowRow(config, row_id);
          const updatedRow = await updateBaserowRow(config, row_id, updateData);

          await logAction(
            supabase,
            numero || updatedRow['Número'],
            row_id,
            'atualizacao_webhook',
            origem,
            previousData,
            updatedRow,
            changedFields,
            null,
            null,
            null,
            webhookId,
            ipAddress,
            userAgent
          );

          return new Response(
            JSON.stringify({ success: true, data: updatedRow }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (action === 'query') {
        const result = await queryBaserow(config, numero || '', 1, 10);
        
        await logAction(
          supabase,
          numero || '*',
          null,
          'consulta_webhook',
          origem,
          null,
          { query: numero, resultCount: result.count },
          null,
          null,
          null,
          null,
          webhookId,
          ipAddress,
          userAgent
        );

        return new Response(
          JSON.stringify({ success: true, data: result.results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Ação inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);

    if (error instanceof ExternalServiceError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Don't expose internal error details
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao processar requisição' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
