import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ElevenLabsSource {
  source: 'ligacoes_ia' | 'propostas';
  label: string;
  configured: boolean;
  used: number;
  limit: number;
  remaining: number;
  pct: number;
  tier: string | null;
  status: string | null;
  next_reset_unix: number | null;
  error?: string;
}

export function useElevenLabsCreditsMulti(enabled: boolean = true) {
  const [sources, setSources] = useState<ElevenLabsSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('elevenlabs-credits-multi', { body: {} });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      setSources((data?.sources || []) as ElevenLabsSource[]);
    } catch (e: any) {
      setError(e?.message || 'Erro ao consultar ElevenLabs');
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  return { sources, loading, error, refresh };
}
