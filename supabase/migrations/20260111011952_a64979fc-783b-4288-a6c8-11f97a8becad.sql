-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function that calls the auto-sync edge function
CREATE OR REPLACE FUNCTION public.trigger_auto_sync_consulta_numeros()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_record RECORD;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Check if auto-sync is active and if it's time to sync
  SELECT * INTO config_record
  FROM consulta_numeros_auto_sync_config
  WHERE is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Auto-sync is not active';
    RETURN;
  END IF;
  
  -- Check if enough time has passed since last sync
  IF config_record.last_auto_sync_at IS NOT NULL AND 
     (EXTRACT(EPOCH FROM (NOW() - config_record.last_auto_sync_at)) / 60) < config_record.interval_minutes THEN
    RAISE NOTICE 'Not time to sync yet';
    RETURN;
  END IF;
  
  -- Get Supabase URL from environment (we'll use a config table for this)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, use the project URL directly
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://udxaxemoozddkwpitngq.supabase.co';
  END IF;
  
  -- Make HTTP request to edge function using pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/auto-sync-consulta-numeros',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Auto-sync triggered';
END;
$$;

-- Schedule the cron job to run every minute (it will check internally if it's time to sync)
SELECT cron.schedule(
  'auto-sync-consulta-numeros',
  '* * * * *',  -- Every minute
  $$SELECT public.trigger_auto_sync_consulta_numeros()$$
);