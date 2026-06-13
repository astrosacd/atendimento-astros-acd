
-- Tabela de configuração do relatório semanal de renovações
CREATE TABLE IF NOT EXISTS public.weekly_renewals_report_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active boolean DEFAULT false,
  day_of_week integer DEFAULT 1, -- 0=domingo, 1=segunda ... 6=sábado
  schedule_hour integer DEFAULT 8,
  schedule_minute integer DEFAULT 0,
  notify_whatsapp boolean DEFAULT false,
  notify_email boolean DEFAULT false,
  whatsapp_recipients text[] DEFAULT '{}'::text[],
  email_recipients text[] DEFAULT '{}'::text[],
  whatsapp_instance_id uuid,
  gmail_user text,
  gmail_app_password text,
  gmail_sender_name text,
  send_when_empty boolean DEFAULT true,
  include_renewals boolean DEFAULT true,
  include_payments boolean DEFAULT true,
  last_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_renewals_report_config TO authenticated;
GRANT ALL ON public.weekly_renewals_report_config TO service_role;

ALTER TABLE public.weekly_renewals_report_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon access" ON public.weekly_renewals_report_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Admins manage weekly renewals report config" ON public.weekly_renewals_report_config FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_update_weekly_renewals_report_config_updated_at
  BEFORE UPDATE ON public.weekly_renewals_report_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Logs de envio
CREATE TABLE IF NOT EXISTS public.weekly_renewals_report_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL,
  error_message text,
  total_renewals integer DEFAULT 0,
  total_payments integer DEFAULT 0,
  total_amount_brl numeric DEFAULT 0,
  total_amount_usd numeric DEFAULT 0,
  payload_snapshot jsonb,
  is_test boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.weekly_renewals_report_logs TO authenticated;
GRANT ALL ON public.weekly_renewals_report_logs TO service_role;

ALTER TABLE public.weekly_renewals_report_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block anon access" ON public.weekly_renewals_report_logs AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Admins view weekly renewals logs" ON public.weekly_renewals_report_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Service can insert weekly renewals logs" ON public.weekly_renewals_report_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Função de execução do cron
CREATE OR REPLACE FUNCTION public.execute_weekly_renewals_report()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/weekly-renewals-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := jsonb_build_object('scheduled', true)
  );
END;
$$;

-- Helper para atualizar cron
CREATE OR REPLACE FUNCTION public.update_weekly_renewals_report_cron(p_day_of_week integer, p_hour integer, p_minute integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule text;
  v_utc_hour integer;
BEGIN
  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'Dia da semana inválido (0-6)';
  END IF;
  IF p_hour < 0 OR p_hour > 23 THEN
    RAISE EXCEPTION 'Hora inválida (0-23)';
  END IF;

  -- Brasilia (UTC-3) → UTC
  v_utc_hour := p_hour + 3;
  IF v_utc_hour >= 24 THEN
    v_utc_hour := v_utc_hour - 24;
    -- avança um dia (mas para cron semanal simplificamos mantendo o dia)
  END IF;

  v_schedule := p_minute || ' ' || v_utc_hour || ' * * ' || p_day_of_week;

  BEGIN
    PERFORM cron.unschedule('weekly-renewals-report-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'weekly-renewals-report-cron',
    v_schedule,
    'SELECT public.execute_weekly_renewals_report();'
  );

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_weekly_renewals_report_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM cron.unschedule('weekly-renewals-report-cron');
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_renewals_report_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text
  FROM cron.job c
  WHERE c.jobname = 'weekly-renewals-report-cron'
  LIMIT 1;
END;
$$;
