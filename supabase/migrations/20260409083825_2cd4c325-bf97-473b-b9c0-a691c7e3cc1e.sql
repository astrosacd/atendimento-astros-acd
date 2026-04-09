
-- Add missing columns to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS notified_at timestamptz DEFAULT NULL;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS consultant_phones text[] DEFAULT '{}';

-- Create calendar_notification_whatsapp_instances table
CREATE TABLE IF NOT EXISTS public.calendar_notification_whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url text NOT NULL,
  api_key text NOT NULL,
  instance_name text NOT NULL,
  is_active boolean DEFAULT true,
  last_used_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_notification_whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view calendar notification whatsapp instances"
  ON public.calendar_notification_whatsapp_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage calendar notification whatsapp instances"
  ON public.calendar_notification_whatsapp_instances FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Create calendar_notification_logs table
CREATE TABLE IF NOT EXISTS public.calendar_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  recipient_type text NOT NULL DEFAULT 'client',
  recipient_name text,
  recipient_contact text,
  message_sent text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  whatsapp_instance_id uuid REFERENCES public.calendar_notification_whatsapp_instances(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view calendar notification logs"
  ON public.calendar_notification_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert calendar notification logs"
  ON public.calendar_notification_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default config values for independent notification
INSERT INTO public.calendar_config (config_key, config_value)
VALUES 
  ('notify_gmail_user', ''),
  ('notify_gmail_password', ''),
  ('notify_cron_enabled', 'false'),
  ('notify_cron_interval', '15')
ON CONFLICT DO NOTHING;

-- Add missing permissions to system_permissions
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_numeros', 'Ver Status de Números', 'Permite visualizar o módulo de Status de Números', 'Status de Números'),
  ('create_numeros', 'Criar Números', 'Permite criar novos números', 'Status de Números'),
  ('edit_numeros', 'Editar Números', 'Permite editar números existentes', 'Status de Números'),
  ('change_numeros_status', 'Alterar Status de Números', 'Permite alterar o status dos números', 'Status de Números'),
  ('change_numeros_obs', 'Alterar Observações de Números', 'Permite alterar observações dos números', 'Status de Números'),
  ('delete_numeros', 'Excluir Números', 'Permite excluir números', 'Status de Números'),
  ('export_numeros', 'Exportar Números', 'Permite exportar números', 'Status de Números'),
  ('view_numeros_history', 'Ver Histórico de Números', 'Permite ver o histórico de números', 'Status de Números'),
  ('manage_numeros_webhooks', 'Gerenciar Webhooks de Números', 'Permite gerenciar webhooks do módulo de números', 'Status de Números'),
  ('manage_numeros_api', 'Gerenciar API de Números', 'Permite gerenciar a API do módulo de números', 'Status de Números'),
  ('manage_revendedor_config', 'Gerenciar Config. Revendedor', 'Permite gerenciar configurações do revendedor', 'Revendedor'),
  ('manage_agenda_notification_config', 'Gerenciar Config. Notificações Agenda', 'Permite gerenciar as configurações de notificação do módulo agenda', 'Agenda')
ON CONFLICT DO NOTHING;

-- Create cron function for calendar notifications
CREATE OR REPLACE FUNCTION public.execute_calendar_notify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/calendar-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Create function to manage calendar notify cron
CREATE OR REPLACE FUNCTION public.update_calendar_notify_cron(p_interval_minutes integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule TEXT;
BEGIN
  IF p_interval_minutes < 1 OR p_interval_minutes > 60 THEN
    RAISE EXCEPTION 'Intervalo deve ser entre 1 e 60 minutos';
  END IF;
  
  v_schedule := '*/' || p_interval_minutes || ' * * * *';
  
  BEGIN
    PERFORM cron.unschedule('calendar-notify-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'calendar-notify-cron',
    v_schedule,
    'SELECT public.execute_calendar_notify();'
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_calendar_notify_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM cron.unschedule('calendar-notify-cron');
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_calendar_notify_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'calendar-notify-cron'
  LIMIT 1;
END;
$$;
