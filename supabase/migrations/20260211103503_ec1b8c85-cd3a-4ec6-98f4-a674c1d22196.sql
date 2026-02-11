
-- Grant access to cron schema for the postgres role used by security definer functions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT SELECT, UPDATE ON cron.job TO postgres;

-- Recreate the function with proper approach: unschedule + reschedule instead of direct UPDATE
CREATE OR REPLACE FUNCTION public.update_remarketing_cron_schedule(new_schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  -- Remove existing remarketing cron job
  BEGIN
    PERFORM cron.unschedule('auto-remarketing-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Create new cron job with updated schedule
  PERFORM cron.schedule(
    'auto-remarketing-cron',
    new_schedule,
    'SELECT public.execute_auto_remarketing();'
  );
END;
$func$;
