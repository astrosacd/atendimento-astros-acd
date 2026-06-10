ALTER TABLE public.cobranca_ligacao_config
  ADD COLUMN IF NOT EXISTS fallback_audio_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_audio_template text NOT NULL DEFAULT 'Oi {nome}, tentei te ligar e não consegui falar contigo. Ouve esse áudio rapidinho 👇',
  ADD COLUMN IF NOT EXISTS fallback_audio_send_text boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fallback_max_per_day integer NOT NULL DEFAULT 1;

ALTER TABLE public.ligacoes_ia_historico
  ADD COLUMN IF NOT EXISTS fallback_audio_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS fallback_audio_error text;

CREATE INDEX IF NOT EXISTS idx_historico_fallback_sent
  ON public.ligacoes_ia_historico (cliente_id, fallback_audio_sent_at)
  WHERE fallback_audio_sent_at IS NOT NULL;