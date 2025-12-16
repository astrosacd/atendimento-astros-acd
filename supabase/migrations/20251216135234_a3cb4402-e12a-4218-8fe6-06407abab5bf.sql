-- Função para buscar o horário atual do cron job
CREATE OR REPLACE FUNCTION public.get_billing_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'daily-billing-cron'
  LIMIT 1;
END;
$function$;