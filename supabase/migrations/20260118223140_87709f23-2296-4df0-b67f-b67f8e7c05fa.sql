-- Tabela de configuração do cron de despesas recorrentes
CREATE TABLE public.despesas_cron_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  day_of_month INTEGER NOT NULL DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_message TEXT,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de logs de execução do cron
CREATE TABLE public.despesas_cron_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  message TEXT,
  despesas_created INTEGER DEFAULT 0,
  despesas_skipped INTEGER DEFAULT 0,
  target_month TEXT,
  error_details TEXT
);

-- Habilitar RLS
ALTER TABLE public.despesas_cron_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas_cron_logs ENABLE ROW LEVEL SECURITY;

-- Políticas - apenas usuários autenticados podem ver/editar
CREATE POLICY "Authenticated users can view cron config"
  ON public.despesas_cron_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update cron config"
  ON public.despesas_cron_config FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view cron logs"
  ON public.despesas_cron_logs FOR SELECT
  TO authenticated
  USING (true);

-- Inserir configuração padrão
INSERT INTO public.despesas_cron_config (is_active, day_of_month, next_run_at)
VALUES (true, 1, date_trunc('month', now() + interval '1 month') + interval '1 day' - interval '1 day');

-- Trigger para updated_at
CREATE TRIGGER update_despesas_cron_config_updated_at
  BEFORE UPDATE ON public.despesas_cron_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();