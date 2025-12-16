-- Função para executar o CRON do divulgador
CREATE OR REPLACE FUNCTION public.execute_divulgador_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_supabase_url TEXT := 'https://udxaxemoozddkwpitngq.supabase.co';
  v_anon_key TEXT;
BEGIN
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM';
  
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/divulgador-send-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := '{}'::jsonb
  );
END;
$func$;

-- Função para obter o schedule atual do CRON do divulgador
CREATE OR REPLACE FUNCTION public.get_divulgador_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'divulgador-send-messages-cron'
  LIMIT 1;
END;
$func$;