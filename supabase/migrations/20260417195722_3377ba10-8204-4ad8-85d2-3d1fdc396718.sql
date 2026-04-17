ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'online',
ADD COLUMN IF NOT EXISTS reference_point TEXT;

-- Index for performance when filtering by meeting_type and start_time
CREATE INDEX IF NOT EXISTS idx_calendar_events_meeting_type_start 
ON public.calendar_events (meeting_type, start_time);