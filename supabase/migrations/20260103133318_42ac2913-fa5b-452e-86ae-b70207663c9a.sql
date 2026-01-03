-- Make cron executions visible in history by logging trigger attempts
CREATE OR REPLACE FUNCTION public.execute_consulta_numeros_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url TEXT := 'https://udxaxemoozddkwpitngq.supabase.co';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM';
  v_log_id uuid;
BEGIN
  -- Log that the cron fired (so UI history shows something even if HTTP call fails)
  INSERT INTO public.consulta_numeros_reminder_logs (
    channel,
    status,
    numbers_count,
    sent_at,
    status_monitored,
    numbers_list,
    error_message
  )
  VALUES (
    'cron_check',
    'started',
    0,
    now(),
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_log_id;

  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/consulta-numeros-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := '{}'::jsonb
    );

    UPDATE public.consulta_numeros_reminder_logs
    SET status = 'triggered'
    WHERE id = v_log_id;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.consulta_numeros_reminder_logs
      SET status = 'error',
          error_message = SQLERRM
      WHERE id = v_log_id;
  END;
END;
$function$;