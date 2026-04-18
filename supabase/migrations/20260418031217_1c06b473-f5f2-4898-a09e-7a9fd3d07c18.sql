-- Função para atualizar/criar o cron job do resumo presencial com horário customizado
CREATE OR REPLACE FUNCTION public.update_calendar_physical_summary_cron(p_hour_brasilia integer, p_minute integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_utc_hour integer;
  v_cron_expr text;
BEGIN
  -- Converter hora Brasília (UTC-3) para UTC: somar 3
  v_utc_hour := (p_hour_brasilia + 3) % 24;
  v_cron_expr := p_minute::text || ' ' || v_utc_hour::text || ' * * *';

  -- Remove jobs antigos
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'calendar-physical-summary-cron';

  -- Cria novo job
  PERFORM cron.schedule(
    'calendar-physical-summary-cron',
    v_cron_expr,
    'SELECT public.execute_calendar_physical_summary();'
  );
END;
$$;

-- Função para desativar o cron do resumo presencial
CREATE OR REPLACE FUNCTION public.disable_calendar_physical_summary_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'calendar-physical-summary-cron';
END;
$$;

-- Adicionar nova chave de configuração para o horário (se não existir)
INSERT INTO public.calendar_config (config_key, config_value)
VALUES ('daily_summary_hour_brasilia', '8')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO public.calendar_config (config_key, config_value)
VALUES ('daily_summary_minute', '0')
ON CONFLICT (config_key) DO NOTHING;