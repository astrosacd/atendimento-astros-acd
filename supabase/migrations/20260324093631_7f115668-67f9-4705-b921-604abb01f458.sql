
-- Calendar events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  meet_link TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Calendar config table
CREATE TABLE public.calendar_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for calendar_events
CREATE POLICY "Authenticated users can view calendar events"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create calendar events"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update calendar events"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete calendar events"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (true);

-- RLS policies for calendar_config
CREATE POLICY "Authenticated users can view calendar config"
  ON public.calendar_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage calendar config"
  ON public.calendar_config FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Updated_at trigger
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_config_updated_at
  BEFORE UPDATE ON public.calendar_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config
INSERT INTO public.calendar_config (config_key, config_value) VALUES
  ('google_calendar_enabled', 'false'),
  ('google_client_id', ''),
  ('google_client_secret', ''),
  ('google_calendar_id', ''),
  ('notify_client_enabled', 'false'),
  ('notify_hours_before', '1'),
  ('notify_channel', 'whatsapp'),
  ('notify_message_template', 'Olá {client_name} 👋\n\nPassando para lembrar da nossa reunião:\n\n🗓️ {date} às {time}\n🔗 {meet_link}');

-- Add agenda permissions
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_agenda', 'Visualizar Agenda', 'Permite visualizar a agenda de reuniões', 'Agenda'),
  ('create_agenda_events', 'Criar Eventos', 'Permite criar novos agendamentos', 'Agenda'),
  ('edit_agenda_events', 'Editar Eventos', 'Permite editar agendamentos existentes', 'Agenda'),
  ('delete_agenda_events', 'Excluir Eventos', 'Permite excluir agendamentos', 'Agenda'),
  ('manage_agenda_config', 'Gerenciar Configurações', 'Permite configurar integrações e notificações da agenda', 'Agenda');
