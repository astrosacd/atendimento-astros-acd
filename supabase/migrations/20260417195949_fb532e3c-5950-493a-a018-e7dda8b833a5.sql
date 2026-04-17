-- Function to execute the physical summary edge function
CREATE OR REPLACE FUNCTION public.execute_calendar_physical_summary()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/calendar-physical-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := '{}'::jsonb
  );
END;
$function$;

-- Schedule the cron job (0 11 * * * = 08:00 AM Brasilia time)
SELECT cron.schedule(
  'calendar-physical-summary-cron',
  '0 11 * * *',
  'SELECT public.execute_calendar_physical_summary();'
);