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

    const startedAt = Date.now();

    // Read optional pagination input (to allow incremental sync to avoid platform timeouts)
    let requestedPage: number | null = null;
    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        if (body && typeof body.page === 'number' && Number.isFinite(body.page) && body.page >= 1) {
          requestedPage = Math.floor(body.page);
        }
      }
    } catch {
      // ignore body parse errors
    }

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
      await supabase.from('consulta_numeros_sync_status').insert({ last_sync_status: 'syncing' });
    } else {
      await supabase
        .from('consulta_numeros_sync_status')
        .update({ last_sync_status: 'syncing', updated_at: new Date().toISOString() })
        .eq('id', existingStatus.id);
    }

    // Fetch fields from Baserow (best effort)
    let fields: any[] = [];
    try {
      const fieldsUrl = `${baserowConfig.api_url}/api/database/fields/table/${baserowConfig.table_id}/`;
      const fieldsRes = await fetchWithRetry(
        fieldsUrl,
        {
          headers: {
            Authorization: `Token ${baserowConfig.api_token}`,
            'Content-Type': 'application/json',
          },
        },
        1,
        12000
      );

      if (fieldsRes.ok) {
        fields = await fieldsRes.json();
        console.log(`[sync-consulta-numeros] Fetched ${fields.length} fields`);

        await supabase
          .from('consulta_numeros_fields_cache')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        await supabase.from('consulta_numeros_fields_cache').insert({ fields_data: fields });
      }
    } catch (e: any) {
      console.warn('[sync-consulta-numeros] Could not fetch fields:', e?.message || String(e));
    }

    // Full sync: fetch ALL pages to properly detect deletions
    const pageSize = 50;

    let page = 1;
    let rowsSyncedThisCall = 0;
    let hasMore = true;
    const allBaserowIds: number[] = []; // Collect all IDs from Baserow

    while (hasMore) {
      const url = new URL(`${baserowConfig.api_url}/api/database/rows/table/${baserowConfig.table_id}/`);
      url.searchParams.set('user_field_names', 'true');
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(pageSize));

      console.log(`[sync-consulta-numeros] Fetching page ${page} (size=${pageSize})...`);

      const res = await fetchWithRetry(
        url.toString(),
        {
          headers: {
            Authorization: `Token ${baserowConfig.api_token}`,
            'Content-Type': 'application/json',
          },
        },
        2,
        30000
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Baserow error: ${errorText}`);
      }

      const json = await res.json();
      const results = Array.isArray(json?.results) ? json.results : [];

      // Collect all Baserow IDs for deletion check later
      for (const row of results) {
        allBaserowIds.push(row.id);
      }

      // Upsert this page immediately (don't keep everything in memory)
      if (results.length > 0) {
        const upsertData = results.map((row: any) => ({
          baserow_row_id: row.id,
          row_data: row,
        }));

        // Upsert in chunks
        const chunkSize = 100;
        for (let i = 0; i < upsertData.length; i += chunkSize) {
          const chunk = upsertData.slice(i, i + chunkSize);
          const { error: upsertError } = await supabase
            .from('consulta_numeros_cache')
            .upsert(chunk, { onConflict: 'baserow_row_id' });
          if (upsertError) throw upsertError;
        }
      }

      rowsSyncedThisCall += results.length;

      hasMore = !!json?.next;
      if (hasMore) page += 1;

      // Budget guard: bail out if we're taking too long (50 seconds)
      if (Date.now() - startedAt > 50000) {
        console.warn('[sync-consulta-numeros] Approaching runtime limit, stopping early');
        break;
      }
    }

    const done = !hasMore;

    // Delete rows that no longer exist in Baserow
    let rowsDeleted = 0;
    if (done && allBaserowIds.length > 0) {
      console.log(`[sync-consulta-numeros] Checking for deleted rows. Total Baserow IDs: ${allBaserowIds.length}`);
      
      // Get all local IDs
      const { data: localRows } = await supabase
        .from('consulta_numeros_cache')
        .select('baserow_row_id');
      
      if (localRows && localRows.length > 0) {
        const baserowIdSet = new Set(allBaserowIds);
        const idsToDelete = localRows
          .filter(row => !baserowIdSet.has(row.baserow_row_id))
          .map(row => row.baserow_row_id);
        
        if (idsToDelete.length > 0) {
          console.log(`[sync-consulta-numeros] Deleting ${idsToDelete.length} rows no longer in Baserow`);
          
          // Delete in chunks
          const chunkSize = 100;
          for (let i = 0; i < idsToDelete.length; i += chunkSize) {
            const chunk = idsToDelete.slice(i, i + chunkSize);
            const { error: deleteError } = await supabase
              .from('consulta_numeros_cache')
              .delete()
              .in('baserow_row_id', chunk);
            if (deleteError) {
              console.error('[sync-consulta-numeros] Delete error:', deleteError);
            }
          }
          rowsDeleted = idsToDelete.length;
        }
      }
    }

    // Update sync status
    const { data: statusRow } = await supabase
      .from('consulta_numeros_sync_status')
      .select('id')
      .single();

    // Get actual total count from the cache
    const { count: finalRowCount } = await supabase
      .from('consulta_numeros_cache')
      .select('*', { count: 'exact', head: true });

    if (statusRow?.id) {
      await supabase
        .from('consulta_numeros_sync_status')
        .update({
          last_sync_at: done ? new Date().toISOString() : null,
          last_sync_status: done ? 'success' : 'syncing',
          rows_synced: finalRowCount || rowsSyncedThisCall,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', statusRow.id);
    }

    console.log(
      `[sync-consulta-numeros] Completed. done=${done} rows_synced=${rowsSyncedThisCall} rows_deleted=${rowsDeleted} total_in_cache=${finalRowCount}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        done,
        rows_synced: rowsSyncedThisCall,
        rows_deleted: rowsDeleted,
        total_in_cache: finalRowCount,
        fields_synced: fields.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[sync-consulta-numeros] Sync failed:', error);

    // Update sync status with error (best effort)
    const { data: statusRow } = await supabase
      .from('consulta_numeros_sync_status')
      .select('id')
      .single();

    if (statusRow?.id) {
      await supabase
        .from('consulta_numeros_sync_status')
        .update({
          last_sync_status: 'error',
          error_message: error?.message || 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', statusRow.id);
    }

    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
