
-- Function to execute process-automations edge function
CREATE OR REPLACE FUNCTION public.execute_process_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/process-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Function to update cron schedule (BRT to UTC conversion)
CREATE OR REPLACE FUNCTION public.update_automations_cron_schedule(p_hour integer, p_minute integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule TEXT;
  v_utc_hour INTEGER;
BEGIN
  v_utc_hour := p_hour + 3;
  IF v_utc_hour >= 24 THEN
    v_utc_hour := v_utc_hour - 24;
  END IF;
  
  v_schedule := p_minute || ' ' || v_utc_hour || ' * * *';
  
  BEGIN
    PERFORM cron.unschedule('process-automations-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'process-automations-cron',
    v_schedule,
    'SELECT public.execute_process_automations();'
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

-- Function to get current cron schedule
CREATE OR REPLACE FUNCTION public.get_automations_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'process-automations-cron'
  LIMIT 1;
END;
$$;

-- Function to disable the cron
CREATE OR REPLACE FUNCTION public.disable_automations_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM cron.unschedule('process-automations-cron');
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;
