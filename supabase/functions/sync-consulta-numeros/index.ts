import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface BaserowConfig {
  api_url: string;
  api_token: string;
  table_id: string;
}

// Increased timeout and retry logic for slow Baserow connections
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  timeoutMs = 60000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    
    try {
      console.log(`[sync-consulta-numeros] Fetch attempt ${attempt}/${maxRetries}: ${url.slice(0, 80)}...`);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error: any) {
      clearTimeout(id);
      lastError = error;
      console.warn(`[sync-consulta-numeros] Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`[sync-consulta-numeros] Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError || new Error('All retries failed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('[sync-consulta-numeros] Starting sync...');

    // Get Baserow config
    const { data: configData, error: configError } = await supabase
      .from('consulta_numeros_config')
      .select('config_key, config_value');

    if (configError || !configData) {
      throw new Error('Failed to get Baserow config');
    }

    const config: Record<string, string> = {};
    configData.forEach((row: any) => {
      config[row.config_key] = row.config_value;
    });

    const baserowConfig: BaserowConfig = {
      api_url: (config.baserow_api_url || '').replace(/\/+$/, ''),
      api_token: config.baserow_api_token || '',
      table_id: config.baserow_table_id || '',
    };

    if (!baserowConfig.api_url || !baserowConfig.api_token || !baserowConfig.table_id) {
      throw new Error('Incomplete Baserow configuration');
    }

    // Ensure sync_status row exists
    const { data: existingStatus } = await supabase
      .from('consulta_numeros_sync_status')
      .select('id')
      .single();

    if (!existingStatus) {
      await supabase
        .from('consulta_numeros_sync_status')
        .insert({ last_sync_status: 'syncing' });
    } else {
      await supabase
        .from('consulta_numeros_sync_status')
        .update({ last_sync_status: 'syncing', updated_at: new Date().toISOString() })
        .eq('id', existingStatus.id);
    }

    // Fetch fields from Baserow
    let fields: any[] = [];
    try {
      const fieldsUrl = `${baserowConfig.api_url}/api/database/fields/table/${baserowConfig.table_id}/`;
      const fieldsRes = await fetchWithRetry(fieldsUrl, {
        headers: {
          Authorization: `Token ${baserowConfig.api_token}`,
          'Content-Type': 'application/json',
        },
      }, 3, 45000);

      if (fieldsRes.ok) {
        fields = await fieldsRes.json();
        console.log(`[sync-consulta-numeros] Fetched ${fields.length} fields`);

        // Save fields to cache
        await supabase
          .from('consulta_numeros_fields_cache')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        
        await supabase
          .from('consulta_numeros_fields_cache')
          .insert({ fields_data: fields });
      }
    } catch (e: any) {
      console.warn('[sync-consulta-numeros] Could not fetch fields:', e.message);
      // Continue anyway - we can still sync rows
    }

    // Fetch all rows from Baserow (paginated)
    let allRows: any[] = [];
    let page = 1;
    const pageSize = 200;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`${baserowConfig.api_url}/api/database/rows/table/${baserowConfig.table_id}/`);
      url.searchParams.set('user_field_names', 'true');
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(pageSize));

      console.log(`[sync-consulta-numeros] Fetching page ${page}...`);

      const res = await fetchWithRetry(url.toString(), {
        headers: {
          Authorization: `Token ${baserowConfig.api_token}`,
          'Content-Type': 'application/json',
        },
      }, 3, 60000);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Baserow error: ${errorText}`);
      }

      const json = await res.json();
      const results = Array.isArray(json?.results) ? json.results : [];
      allRows.push(...results);

      console.log(`[sync-consulta-numeros] Page ${page}: ${results.length} rows (total: ${allRows.length})`);

      hasMore = !!json.next;
      page++;

      // Safety limit
      if (page > 100) {
        console.warn('[sync-consulta-numeros] Hit page limit');
        break;
      }
    }

    console.log(`[sync-consulta-numeros] Total rows fetched: ${allRows.length}`);

    // Upsert all rows into cache
    const upsertData = allRows.map((row) => ({
      baserow_row_id: row.id,
      row_data: row,
    }));

    // Delete rows that no longer exist in Baserow
    const currentIds = allRows.map((r) => r.id);
    if (currentIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('consulta_numeros_cache')
        .delete()
        .not('baserow_row_id', 'in', `(${currentIds.join(',')})`);
      
      if (deleteError) {
        console.warn('[sync-consulta-numeros] Error deleting old rows:', deleteError);
      }
    }

    // Batch upsert in chunks
    const chunkSize = 100;
    for (let i = 0; i < upsertData.length; i += chunkSize) {
      const chunk = upsertData.slice(i, i + chunkSize);
      const { error: upsertError } = await supabase
        .from('consulta_numeros_cache')
        .upsert(chunk, { onConflict: 'baserow_row_id' });

      if (upsertError) {
        console.error('[sync-consulta-numeros] Upsert error:', upsertError);
        throw upsertError;
      }
    }

    // Update sync status
    const { data: statusRow } = await supabase
      .from('consulta_numeros_sync_status')
      .select('id')
      .single();

    await supabase
      .from('consulta_numeros_sync_status')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'success',
        rows_synced: allRows.length,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', statusRow?.id);

    console.log(`[sync-consulta-numeros] Sync completed successfully: ${allRows.length} rows`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sync completed', 
        rows_synced: allRows.length,
        fields_synced: fields.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[sync-consulta-numeros] Sync failed:', error);

    // Update sync status with error
    const { data: statusRow } = await supabase
      .from('consulta_numeros_sync_status')
      .select('id')
      .single();

    if (statusRow) {
      await supabase
        .from('consulta_numeros_sync_status')
        .update({
          last_sync_status: 'error',
          error_message: error.message || 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', statusRow.id);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
