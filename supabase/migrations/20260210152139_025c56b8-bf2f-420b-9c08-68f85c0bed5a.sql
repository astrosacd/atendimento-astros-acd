
-- Create a function to update the remarketing cron schedule
CREATE OR REPLACE FUNCTION public.update_remarketing_cron_schedule(new_schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cron.job 
  SET schedule = new_schedule 
  WHERE command LIKE '%auto-remarketing%';
END;
$$;
