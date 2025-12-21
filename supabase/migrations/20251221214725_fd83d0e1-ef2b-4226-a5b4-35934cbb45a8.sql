-- Function to execute the consulta-numeros-reminder cron
CREATE OR REPLACE FUNCTION public.execute_consulta_numeros_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT := 'https://udxaxemoozddkwpitngq.supabase.co';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM';
BEGIN
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/consulta-numeros-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Function to get the current cron schedule
CREATE OR REPLACE FUNCTION public.get_consulta_numeros_reminder_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'consulta-numeros-reminder-cron'
  LIMIT 1;
END;
$$;

-- Function to update cron schedule
CREATE OR REPLACE FUNCTION public.update_consulta_numeros_reminder_cron(p_interval_hours integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule TEXT;
BEGIN
  IF p_interval_hours < 1 OR p_interval_hours > 6 THEN
    RAISE EXCEPTION 'Intervalo deve ser entre 1 e 6 horas';
  END IF;
  
  -- Schedule: run every X hours
  v_schedule := '0 */' || p_interval_hours || ' * * *';
  
  BEGIN
    PERFORM cron.unschedule('consulta-numeros-reminder-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'consulta-numeros-reminder-cron',
    v_schedule,
    'SELECT public.execute_consulta_numeros_reminder();'
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

-- Function to disable cron
CREATE OR REPLACE FUNCTION public.disable_consulta_numeros_reminder_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM cron.unschedule('consulta-numeros-reminder-cron');
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Create default cron job (every hour)
SELECT cron.schedule(
  'consulta-numeros-reminder-cron',
  '0 * * * *',
  'SELECT public.execute_consulta_numeros_reminder();'
);