-- Make cron invocation resilient to cold-starts by increasing pg_net timeout
-- Also include a body marker to distinguish cron vs manual.

CREATE OR REPLACE FUNCTION public.execute_consulta_numeros_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT := 'https://udxaxemoozddkwpitngq.supabase.co';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM';
BEGIN
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/consulta-numeros-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon_key,
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object('source', 'cron'),
    timeout_milliseconds := 30000
  );
END;
$function$;