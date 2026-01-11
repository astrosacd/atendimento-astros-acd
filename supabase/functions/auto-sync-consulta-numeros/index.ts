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

// Fetch with timeout and retry
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2,
  timeoutMs = 30000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    
    try {
      console.log(`[auto-sync] Fetch attempt ${attempt}/${maxRetries}`);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error: any) {
      clearTimeout(id);
      lastError = error;
      console.warn(`[auto-sync] Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
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
    console.log('[auto-sync] Checking auto-sync configuration...');

    // Get auto-sync config
    const { data: autoSyncConfig, error: configError } = await supabase
      .from('consulta_numeros_auto_sync_config')
      .select('*')
      .single();

    if (configError || !autoSyncConfig) {
      console.log('[auto-sync] No auto-sync config found');
      return new Response(
        JSON.stringify({ success: false, message: 'No auto-sync config found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if auto-sync is active
    if (!autoSyncConfig.is_active) {
      console.log('[auto-sync] Auto-sync is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Auto-sync is disabled', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if it's time to sync (based on interval)
    const now = new Date();
    const lastSync = autoSyncConfig.last_auto_sync_at ? new Date(autoSyncConfig.last_auto_sync_at) : null;
    const intervalMs = autoSyncConfig.interval_minutes * 60 * 1000;

    if (lastSync && (now.getTime() - lastSync.getTime()) < intervalMs) {
      const nextSyncAt = new Date(lastSync.getTime() + intervalMs);
      console.log(`[auto-sync] Not time to sync yet. Next sync at: ${nextSyncAt.toISOString()}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Not time to sync yet',
          skipped: true,
          next_sync_at: nextSyncAt.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[auto-sync] Starting automatic synchronization...');

    // Get Baserow config
    const { data: baserowConfigData, error: baserowConfigError } = await supabase
      .from('consulta_numeros_config')
      .select('config_key, config_value');

    if (baserowConfigError || !baserowConfigData) {
      throw new Error('Failed to get Baserow config');
    }

    const config: Record<string, string> = {};
    baserowConfigData.forEach((row: any) => {
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

    // Fetch all rows from Baserow (paginated)
    const pageSize = 100;
    let page = 1;
    let hasMore = true;
    let totalRowsSynced = 0;
    let totalRowsDeleted = 0;
    const allBaserowIds: number[] = [];
    const startedAt = Date.now();
    const maxRuntimeMs = 25000; // 25 seconds max

    while (hasMore) {
      // Check runtime budget
      if (Date.now() - startedAt > maxRuntimeMs) {
        console.warn('[auto-sync] Approaching runtime limit, stopping');
        break;
      }

      const url = new URL(`${baserowConfig.api_url}/api/database/rows/table/${baserowConfig.table_id}/`);
      url.searchParams.set('user_field_names', 'true');
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(pageSize));

      console.log(`[auto-sync] Fetching page ${page}...`);

      const res = await fetchWithRetry(
        url.toString(),
        {
          headers: {
            Authorization: `Token ${baserowConfig.api_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Baserow error: ${errorText}`);
      }

      const json = await res.json();
      const results = Array.isArray(json?.results) ? json.results : [];

      // Upsert rows and collect IDs
      if (results.length > 0) {
        const getStatusValue = (row: any): string | null => {
          const val = row?.excluido_da_base?.value ?? row?.excluido_da_base ?? row?.status?.value ?? row?.status ?? null;
          return typeof val === 'string' && val.trim() ? val.trim() : null;
        };

        const upsertData = results.map((row: any) => {
          allBaserowIds.push(row.id);
          return {
            baserow_row_id: row.id,
            row_data: row,
          };
        });

        // Diff against existing cache to record status changes caused externally
        const idsThisPage = upsertData.map((r: any) => r.baserow_row_id);
        const { data: existingRows, error: existingError } = await supabase
          .from('consulta_numeros_cache')
          .select('baserow_row_id, row_data')
          .in('baserow_row_id', idsThisPage);

        if (existingError) {
          console.warn('[auto-sync] Could not fetch existing cache rows for diff:', existingError);
        }

        const existingMap = new Map<number, any>();
        (existingRows || []).forEach((r: any) => existingMap.set(r.baserow_row_id, r.row_data));

        const historyInserts: any[] = [];
        for (const row of results) {
          const previous = existingMap.get(row.id);
          if (!previous) continue;

          const prevStatus = getStatusValue(previous);
          const nextStatus = getStatusValue(row);
          if (!prevStatus || !nextStatus) continue;
          if (prevStatus === nextStatus) continue;

          historyInserts.push({
            acao: 'atualizacao_status',
            numero: String(row.numero ?? previous?.numero ?? ''),
            origem: 'auto_sync',
            baserow_row_id: String(row.id),
            dados_anteriores: previous,
            dados_novos: row,
          });
        }

        if (historyInserts.length > 0) {
          const { error: historyError } = await supabase
            .from('consulta_numeros_history')
            .insert(historyInserts);
          if (historyError) {
            console.warn('[auto-sync] Could not insert history entries:', historyError);
          } else {
            console.log(`[auto-sync] Logged ${historyInserts.length} status change(s) into history`);
          }
        }

        const { error: upsertError } = await supabase
          .from('consulta_numeros_cache')
          .upsert(upsertData, { onConflict: 'baserow_row_id' });

        if (upsertError) throw upsertError;
        totalRowsSynced += results.length;
      }

      hasMore = !!json?.next;
      page++;
    }

    // Delete rows that no longer exist in Baserow
    if (allBaserowIds.length > 0) {
      console.log(`[auto-sync] Checking for deleted rows (total Baserow IDs: ${allBaserowIds.length})...`);
      
      const { data: localRows, error: fetchError } = await supabase
        .from('consulta_numeros_cache')
        .select('baserow_row_id');
      
      if (fetchError) {
        console.error('[auto-sync] Error fetching local rows:', fetchError);
      } else if (localRows) {
        const baserowIdSet = new Set(allBaserowIds);
        const idsToDelete = localRows
          .map(row => row.baserow_row_id)
          .filter(id => !baserowIdSet.has(id));
        
        if (idsToDelete.length > 0) {
          console.log(`[auto-sync] Deleting ${idsToDelete.length} rows that no longer exist in Baserow...`);
          
          const { error: deleteError } = await supabase
            .from('consulta_numeros_cache')
            .delete()
            .in('baserow_row_id', idsToDelete);
          
          if (deleteError) {
            console.error('[auto-sync] Error deleting rows:', deleteError);
          } else {
            totalRowsDeleted = idsToDelete.length;
            console.log(`[auto-sync] Deleted ${totalRowsDeleted} rows`);
          }
        }
      }
    }

    // Update auto-sync config with last sync time and next scheduled
    const nextScheduledAt = new Date(now.getTime() + intervalMs);
    await supabase
      .from('consulta_numeros_auto_sync_config')
      .update({
        last_auto_sync_at: now.toISOString(),
        next_scheduled_at: nextScheduledAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', autoSyncConfig.id);

    // Also update sync status table
    const { data: statusRow } = await supabase
      .from('consulta_numeros_sync_status')
      .select('id')
      .single();

    if (statusRow?.id) {
      await supabase
        .from('consulta_numeros_sync_status')
        .update({
          last_sync_at: now.toISOString(),
          last_sync_status: 'success',
          rows_synced: totalRowsSynced,
          error_message: null,
          updated_at: now.toISOString(),
        })
        .eq('id', statusRow.id);
    }

    console.log(`[auto-sync] Completed! Synced ${totalRowsSynced} rows, deleted ${totalRowsDeleted} rows`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Auto-sync completed',
        rows_synced: totalRowsSynced,
        rows_deleted: totalRowsDeleted,
        next_sync_at: nextScheduledAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[auto-sync] Error:', error);

    // Log error in auto-sync config
    await supabase
      .from('consulta_numeros_auto_sync_config')
      .update({
        updated_at: new Date().toISOString(),
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
