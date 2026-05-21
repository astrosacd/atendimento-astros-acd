
CREATE TABLE public.cobranca_ligacao_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  dia_alvo date NOT NULL,
  status text NOT NULL DEFAULT 'success',
  enqueued integer NOT NULL DEFAULT 0,
  scanned integer NOT NULL DEFAULT 0,
  dias_processados integer[] NOT NULL DEFAULT '{}',
  message text,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobranca_ligacao_logs_executed_at ON public.cobranca_ligacao_logs(executed_at DESC);

ALTER TABLE public.cobranca_ligacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cobranca ligacao logs"
ON public.cobranca_ligacao_logs FOR SELECT
TO authenticated
USING (public.is_admin());
