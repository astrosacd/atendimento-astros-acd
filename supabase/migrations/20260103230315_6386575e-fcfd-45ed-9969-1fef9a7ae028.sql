-- Increase pg_net timeout for consulta_numeros_reminder cron invocations
-- This avoids premature 5s timeouts when the function needs to fetch + process many rows.

CREATE OR REPLACE FUNCTION public.execute_consulta_numeros_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Invoke the backend function endpoint. We use a generous timeout because the reminder
  -- may need to paginate through many rows before sending notifications.
  SELECT net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/consulta-numeros-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := jsonb_build_object('forceRun', false)::jsonb,
    timeout_milliseconds := 300000
  ) INTO request_id;

  -- Optional: could log request_id to a table, but keep minimal changes.
  PERFORM request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_consulta_numeros_reminder() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_consulta_numeros_reminder() TO postgres;