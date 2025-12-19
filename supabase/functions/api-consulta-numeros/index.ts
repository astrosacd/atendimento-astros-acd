import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

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

// Get Baserow configuration
async function getBaserowConfig(supabase: any): Promise<BaserowConfig | null> {
  const { data, error } = await supabase
    .from('consulta_numeros_config')
    .select('config_key, config_value');

  if (error || !data) {
    console.error('Error fetching Baserow config:', error);
    return null;
  }

  const config: any = {};
  data.forEach((row: any) => {
    config[row.config_key] = row.config_value;
  });

  if (!config.baserow_api_url || !config.baserow_api_token || !config.baserow_table_id) {
    console.error('Baserow configuration incomplete');
    return null;
  }

  return {
    api_url: config.baserow_api_url,
    api_token: config.baserow_api_token,
    table_id: config.baserow_table_id,
    database_id: config.baserow_database_id || '',
  };
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

// Map Baserow data using field mappings - translate from Baserow column names to standard names
function mapBaserowData(rows: any[], mappings: FieldMapping[]): any[] {
  if (!mappings || mappings.length === 0) {
    // If no mappings, return data as-is
    return rows;
  }

  return rows.map(row => {
    const mappedRow: any = {
      id: row.id,
      order: row.order,
    };

    // Map each field using the configured mappings
    for (const mapping of mappings) {
      const baserowFieldName = mapping.baserow_field_name;
      const systemFieldName = mapping.field_name;
      
      // Try to get value using baserow field name
      if (row[baserowFieldName] !== undefined) {
        // Map to standardized names that frontend expects
        switch (systemFieldName) {
          case 'numero':
            mappedRow['Número'] = row[baserowFieldName];
            break;
          case 'status':
            mappedRow['Status'] = row[baserowFieldName];
            break;
          case 'observacoes':
            mappedRow['Observações'] = row[baserowFieldName];
            break;
          case 'origem':
            mappedRow['Origem'] = row[baserowFieldName];
            break;
          case 'data_cadastro':
            mappedRow['Data de Cadastro'] = row[baserowFieldName];
            break;
          default:
            mappedRow[systemFieldName] = row[baserowFieldName];
        }
      }
    }

    // Also keep original fields for any unmapped data
    for (const key of Object.keys(row)) {
      if (!mappedRow.hasOwnProperty(key) && key !== 'id' && key !== 'order') {
        mappedRow[key] = row[key];
      }
    }

    return mappedRow;
  });
}

// Get Baserow field name from system field name
function getBaserowFieldName(mappings: FieldMapping[], systemFieldName: string): string {
  const mapping = mappings.find(m => m.field_name === systemFieldName);
  if (mapping) {
    return mapping.baserow_field_name;
  }
  // Default fallback to Portuguese names if no mapping found
  const defaults: Record<string, string> = {
    'numero': 'Número',
    'status': 'Status',
    'observacoes': 'Observações',
    'origem': 'Origem',
    'data_cadastro': 'Data de Cadastro',
  };
  return defaults[systemFieldName] || systemFieldName;
}

// Query Baserow
async function queryBaserow(config: BaserowConfig, searchQuery: string, page: number = 1, pageSize: number = 25, statusFilter?: string) {
  const url = new URL(`${config.api_url}/api/database/rows/table/${config.table_id}/`);
  url.searchParams.append('user_field_names', 'true');
  url.searchParams.append('page', page.toString());
  url.searchParams.append('size', pageSize.toString());
  
  if (searchQuery) {
    url.searchParams.append('search', searchQuery);
  }
  
  if (statusFilter) {
    url.searchParams.append('filter__Status__equal', statusFilter);
  }

  console.log('Querying Baserow:', url.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Baserow query error:', errorText);
    throw new Error(`Baserow error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Get single row from Baserow
async function getBaserowRow(config: BaserowConfig, rowId: string) {
  const url = `${config.api_url}/api/database/rows/table/${config.table_id}/${rowId}/?user_field_names=true`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Baserow error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Update Baserow row
async function updateBaserowRow(config: BaserowConfig, rowId: string, data: any) {
  const url = `${config.api_url}/api/database/rows/table/${config.table_id}/${rowId}/?user_field_names=true`;

  console.log('Updating Baserow row:', rowId, data);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Baserow update error:', errorText);
    throw new Error(`Baserow error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Create Baserow row
async function createBaserowRow(config: BaserowConfig, data: any) {
  const url = `${config.api_url}/api/database/rows/table/${config.table_id}/?user_field_names=true`;

  console.log('Creating Baserow row:', data);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Baserow create error:', errorText);
    throw new Error(`Baserow error: ${response.status} - ${errorText}`);
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

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return [];
  }

  const fields = await response.json();
  const statusField = fields.find((f: any) => f.name === 'Status');
  
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1] || '';

    // Get authentication
    let userId: string | null = null;
    let userEmail: string | null = null;
    let apiKeyId: string | null = null;
    let webhookId: string | null = null;
    let origem = 'painel';

    const authHeader = req.headers.get('Authorization');
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
      // Verify JWT token
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token inválido' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
      userEmail = user.email || null;
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
      // GET /consultar - Query numbers
      if (endpoint === 'consultar' || endpoint === 'api-consulta-numeros') {
        const searchQuery = url.searchParams.get('q') || '';
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('size') || '25');
        const statusFilter = url.searchParams.get('status') || undefined;

        const result = await queryBaserow(config, searchQuery, page, pageSize, statusFilter);
        
        // Get field mappings and apply them to results
        const fieldMappings = await getFieldMappings(supabase);
        const mappedData = mapBaserowData(result.results || [], fieldMappings);

        // Log consultation
        await logAction(
          supabase,
          searchQuery || '*',
          null,
          'consulta',
          origem,
          null,
          { query: searchQuery, page, pageSize, statusFilter, resultCount: result.count },
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
            data: mappedData,
            pagination: {
              count: result.count,
              page,
              pageSize,
              totalPages: Math.ceil(result.count / pageSize),
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      const { row_id, status, observacoes, numero } = body;

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

      // Get field mappings for proper field names
      const fieldMappings = await getFieldMappings(supabase);

      // Build update data using field mappings
      const updateData: any = {};
      const changedFields: string[] = [];

      if (status !== undefined) {
        const statusFieldName = getBaserowFieldName(fieldMappings, 'status');
        updateData[statusFieldName] = status;
        changedFields.push('status');
      }

      if (observacoes !== undefined) {
        const obsFieldName = getBaserowFieldName(fieldMappings, 'observacoes');
        updateData[obsFieldName] = observacoes;
        changedFields.push('observacoes');
      }

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
      await logAction(
        supabase,
        numero || updatedRow['Número'] || row_id,
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
        numero: numero || updatedRow['Número'],
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
      const { numero, status, observacoes, origem: origemCadastro } = body;

      if (!numero) {
        return new Response(
          JSON.stringify({ success: false, error: 'Número é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get field mappings for proper field names
      const fieldMappings = await getFieldMappings(supabase);

      // Build create data using field mappings
      const numeroFieldName = getBaserowFieldName(fieldMappings, 'numero');
      const createData: any = {
        [numeroFieldName]: numero,
      };

      if (status) {
        const statusFieldName = getBaserowFieldName(fieldMappings, 'status');
        createData[statusFieldName] = status;
      }
      if (observacoes) {
        const obsFieldName = getBaserowFieldName(fieldMappings, 'observacoes');
        createData[obsFieldName] = observacoes;
      }
      if (origemCadastro) {
        const origemFieldName = getBaserowFieldName(fieldMappings, 'origem');
        createData[origemFieldName] = origemCadastro;
      }

      // Create in Baserow
      const newRow = await createBaserowRow(config, createData);

      // Log action
      await logAction(
        supabase,
        numero,
        newRow.id?.toString() || null,
        'cadastro',
        origem,
        null,
        newRow,
        ['numero', status ? 'status' : null, observacoes ? 'observacoes' : null].filter(Boolean) as string[],
        userId,
        userEmail,
        apiKeyId,
        webhookId,
        ipAddress,
        userAgent
      );

      // Trigger webhooks
      await triggerWebhooks(supabase, 'cadastro', {
        numero,
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
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
