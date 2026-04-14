
-- Function to execute the reports AI analysis edge function
CREATE OR REPLACE FUNCTION public.execute_reports_analysis_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/reports-ai-analysis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := jsonb_build_object('scheduled', true)
  );
END;
$$;

-- Function to update the reports analysis cron schedule
CREATE OR REPLACE FUNCTION public.update_reports_analysis_cron(p_frequency text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule TEXT;
BEGIN
  -- Remove existing job if any
  BEGIN
    PERFORM cron.unschedule('reports-analysis-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF p_frequency = 'daily' THEN
    -- Daily at 08:00 Brasilia (11:00 UTC)
    v_schedule := '0 11 * * *';
  ELSIF p_frequency = 'weekly' THEN
    -- Weekly on Monday at 08:00 Brasilia (11:00 UTC)
    v_schedule := '0 11 * * 1';
  ELSE
    RAISE EXCEPTION 'Frequência inválida: use daily ou weekly';
  END IF;

  PERFORM cron.schedule(
    'reports-analysis-cron',
    v_schedule,
    'SELECT public.execute_reports_analysis_cron();'
  );

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

-- Function to disable reports analysis cron
CREATE OR REPLACE FUNCTION public.disable_reports_analysis_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM cron.unschedule('reports-analysis-cron');
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to get reports analysis cron schedule
CREATE OR REPLACE FUNCTION public.get_reports_analysis_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'reports-analysis-cron'
  LIMIT 1;
END;
$$;
