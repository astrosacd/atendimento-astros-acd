import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const LS_URL = 'horario_supabase_url';
const LS_KEY = 'horario_supabase_anon_key';

let cached: { url: string; key: string; client: SupabaseClient } | null = null;
let loadPromise: Promise<SupabaseClient | null> | null = null;

export function getCachedHorarioConfig() {
  const url = localStorage.getItem(LS_URL) || '';
  const key = localStorage.getItem(LS_KEY) || '';
  return { url, key };
}

async function fetchConfigFromDB(): Promise<{ url: string; key: string }> {
  const { data } = await supabase
    .from('system_settings')
    .select('key,value')
    .in('key', [LS_URL, LS_KEY]);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => {
    map[r.key] = r.value;
  });
  const url = map[LS_URL] || '';
  const key = map[LS_KEY] || '';
  if (url) localStorage.setItem(LS_URL, url);
  if (key) localStorage.setItem(LS_KEY, key);
  return { url, key };
}

export async function getHorarioSupabase(forceReload = false): Promise<SupabaseClient | null> {
  if (forceReload) {
    cached = null;
    loadPromise = null;
  }
  if (cached) return cached.client;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    let { url, key } = getCachedHorarioConfig();
    if (!url || !key) {
      const fresh = await fetchConfigFromDB();
      url = fresh.url;
      key = fresh.key;
    }
    if (!url || !key) return null;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cached = { url, key, client };
    return client;
  })();

  return loadPromise;
}

export async function saveHorarioConfig(url: string, key: string) {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();
  const rows = [
    { key: LS_URL, value: cleanUrl },
    { key: LS_KEY, value: cleanKey },
  ];
  const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
  localStorage.setItem(LS_URL, cleanUrl);
  localStorage.setItem(LS_KEY, cleanKey);
  cached = null;
  loadPromise = null;
  window.dispatchEvent(new CustomEvent('horario-config-changed'));
}
