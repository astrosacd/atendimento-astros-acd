
-- Add google_event_id and source to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local';

-- Create index on google_event_id for fast lookups during sync
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_event_id ON public.calendar_events(google_event_id);

-- Create default participants table for WhatsApp groups
CREATE TABLE IF NOT EXISTS public.whatsapp_group_default_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_group_default_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view default participants"
  ON public.whatsapp_group_default_participants FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage default participants"
  ON public.whatsapp_group_default_participants FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update default participants"
  ON public.whatsapp_group_default_participants FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete default participants"
  ON public.whatsapp_group_default_participants FOR DELETE
  TO authenticated USING (true);

-- Add auto-sync config entries
INSERT INTO public.calendar_config (config_key, config_value) VALUES
  ('auto_sync_enabled', 'false'),
  ('sync_interval_minutes', '15'),
  ('last_sync_at', '')
ON CONFLICT (config_key) DO NOTHING;

-- Create function to execute calendar sync via HTTP
CREATE OR REPLACE FUNCTION public.execute_calendar_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/calendar-sync-google',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Function to update calendar sync cron schedule
CREATE OR REPLACE FUNCTION public.update_calendar_sync_cron(p_interval_minutes integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule TEXT;
BEGIN
  IF p_interval_minutes < 5 OR p_interval_minutes > 60 THEN
    RAISE EXCEPTION 'Intervalo deve ser entre 5 e 60 minutos';
  END IF;
  
  v_schedule := '*/' || p_interval_minutes || ' * * * *';
  
  BEGIN
    PERFORM cron.unschedule('calendar-sync-google-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'calendar-sync-google-cron',
    v_schedule,
    'SELECT public.execute_calendar_sync();'
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

-- Function to disable calendar sync cron
CREATE OR REPLACE FUNCTION public.disable_calendar_sync_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM cron.unschedule('calendar-sync-google-cron');
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to get calendar sync cron schedule
CREATE OR REPLACE FUNCTION public.get_calendar_sync_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'calendar-sync-google-cron'
  LIMIT 1;
END;
$$;
