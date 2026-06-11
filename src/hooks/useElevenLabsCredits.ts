import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ElevenLabsCredits {
  used: number;
  limit: number;
  remaining: number;
  pct: number;
  tier: string | null;
  status: string | null;
  next_reset_unix: number | null;
}

export function useElevenLabsCredits(enabled: boolean = true) {
  const [data, setData] = useState<ElevenLabsCredits | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('ligacoes-ia-credits', {
        body: {},
      });
      if (err) throw err;
      if (res?.error) throw new Error(res.error);
      setData(res as ElevenLabsCredits);
    } catch (e: any) {
      setError(e?.message || 'Erro ao consultar ElevenLabs');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
}
