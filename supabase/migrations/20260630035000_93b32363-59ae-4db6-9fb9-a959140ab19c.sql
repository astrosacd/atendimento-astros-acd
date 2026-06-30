CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.bloqueios_historico (
  id BIGSERIAL PRIMARY KEY,
  bloqueio_id BIGINT,
  acao TEXT NOT NULL CHECK (acao IN ('criado','editado','excluido')),
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','cron')),
  user_id UUID,
  user_nome TEXT,
  user_email TEXT,
  data_bloqueio DATE,
  dia_todo BOOLEAN,
  hora_inicio TIME,
  hora_fim TIME,
  motivo TEXT,
  dados_antes JSONB,
  dados_depois JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bloqueios_historico_created ON public.bloqueios_historico (created_at DESC);
CREATE INDEX idx_bloqueios_historico_acao ON public.bloqueios_historico (acao);
CREATE INDEX idx_bloqueios_historico_origem ON public.bloqueios_historico (origem);

GRANT SELECT, INSERT ON public.bloqueios_historico TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bloqueios_historico_id_seq TO authenticated;
GRANT ALL ON public.bloqueios_historico TO service_role;
GRANT ALL ON SEQUENCE public.bloqueios_historico_id_seq TO service_role;

ALTER TABLE public.bloqueios_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem historico" ON public.bloqueios_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem historico" ON public.bloqueios_historico FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.horario_cleanup_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  external_url TEXT,
  external_anon_key TEXT,
  cleanup_hour INT NOT NULL DEFAULT 3 CHECK (cleanup_hour BETWEEN 0 AND 23),
  cleanup_minute INT NOT NULL DEFAULT 0 CHECK (cleanup_minute BETWEEN 0 AND 59),
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_deleted INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.horario_cleanup_config (id) VALUES (1);

GRANT SELECT ON public.horario_cleanup_config TO authenticated;
GRANT ALL ON public.horario_cleanup_config TO service_role;

ALTER TABLE public.horario_cleanup_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissao le cleanup config" ON public.horario_cleanup_config
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'manage_horario_comercial'));

CREATE TRIGGER trg_horario_cleanup_config_updated
  BEFORE UPDATE ON public.horario_cleanup_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_horario_external_connection(p_url TEXT, p_anon_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_horario_comercial') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.horario_cleanup_config
     SET external_url = p_url, external_anon_key = p_anon_key, updated_at = now()
   WHERE id = 1;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.get_horario_cleanup_config()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cfg RECORD; v_job RECORD;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_horario_comercial') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT cleanup_hour, cleanup_minute, enabled, last_run_at, last_run_deleted,
         (external_url IS NOT NULL AND external_anon_key IS NOT NULL) AS has_connection
    INTO v_cfg FROM public.horario_cleanup_config WHERE id = 1;
  SELECT schedule, active INTO v_job FROM cron.job WHERE jobname = 'horario-bloqueios-cleanup-cron' LIMIT 1;
  RETURN jsonb_build_object(
    'cleanup_hour', v_cfg.cleanup_hour,
    'cleanup_minute', v_cfg.cleanup_minute,
    'enabled', v_cfg.enabled,
    'has_connection', v_cfg.has_connection,
    'last_run_at', v_cfg.last_run_at,
    'last_run_deleted', v_cfg.last_run_deleted,
    'cron_schedule', v_job.schedule,
    'cron_active', COALESCE(v_job.active, false)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.execute_horario_bloqueios_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/horario-bloqueios-cleanup',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := jsonb_build_object('source','cron')
  );
END; $$;

CREATE OR REPLACE FUNCTION public.set_horario_cleanup_schedule(p_hour INT, p_minute INT, p_enabled BOOLEAN)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_utc_hour INT; v_schedule TEXT;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'manage_horario_comercial') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_hour < 0 OR p_hour > 23 OR p_minute < 0 OR p_minute > 59 THEN RAISE EXCEPTION 'Hora/minuto inválidos'; END IF;
  UPDATE public.horario_cleanup_config
     SET cleanup_hour = p_hour, cleanup_minute = p_minute, enabled = p_enabled, updated_at = now()
   WHERE id = 1;
  v_utc_hour := (p_hour + 3) % 24;
  v_schedule := p_minute || ' ' || v_utc_hour || ' * * *';
  BEGIN PERFORM cron.unschedule('horario-bloqueios-cleanup-cron'); EXCEPTION WHEN OTHERS THEN NULL; END;
  IF p_enabled THEN
    PERFORM cron.schedule('horario-bloqueios-cleanup-cron', v_schedule, 'SELECT public.execute_horario_bloqueios_cleanup();');
  END IF;
  RETURN jsonb_build_object('ok', true, 'schedule', v_schedule, 'enabled', p_enabled);
END; $$;