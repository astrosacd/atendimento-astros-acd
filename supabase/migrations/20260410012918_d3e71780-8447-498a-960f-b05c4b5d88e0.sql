
INSERT INTO system_permissions (key, name, description, category)
VALUES ('access_agenda_meet_links', 'Acessar links do Meet', 'Permite acessar e clicar nos links do Google Meet nos eventos da agenda', 'Agenda')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.calendar_event_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  event_title TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  user_id UUID,
  user_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event history"
ON public.calendar_event_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create event history"
ON public.calendar_event_history FOR INSERT TO authenticated WITH CHECK (true);
