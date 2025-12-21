-- Criar tabela para configurações de lembretes de consulta de números
CREATE TABLE public.consulta_numeros_reminder_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT false,
  status_to_monitor TEXT[] NOT NULL DEFAULT '{}',
  cron_interval_hours INTEGER NOT NULL DEFAULT 1,
  cron_start_hour INTEGER NOT NULL DEFAULT 8,
  cron_end_hour INTEGER NOT NULL DEFAULT 18,
  cron_days TEXT[] NOT NULL DEFAULT ARRAY['1','2','3','4','5','6'],
  -- WhatsApp config
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  evolution_api_url TEXT,
  evolution_api_key TEXT,
  evolution_instance_name TEXT,
  whatsapp_group_id TEXT,
  whatsapp_mention_all BOOLEAN NOT NULL DEFAULT true,
  -- Gmail config
  gmail_enabled BOOLEAN NOT NULL DEFAULT false,
  gmail_user TEXT,
  gmail_app_password TEXT,
  gmail_recipients TEXT[] DEFAULT '{}',
  gmail_subject_template TEXT DEFAULT '🛑 Atenção: {count} número(s) para desbanimento',
  -- Message template
  message_template TEXT DEFAULT '🛑 Atenção, tem {count} numero(s) para ser(em) desbanido(s)!

{numbers}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consulta_numeros_reminder_config ENABLE ROW LEVEL SECURITY;

-- Policy for admin access only
CREATE POLICY "Admins can manage reminder config"
ON public.consulta_numeros_reminder_config
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Logs for reminder sends
CREATE TABLE public.consulta_numeros_reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  numbers_count INTEGER NOT NULL DEFAULT 0,
  numbers_list TEXT[],
  status_monitored TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consulta_numeros_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Policy for admin access only
CREATE POLICY "Admins can view reminder logs"
ON public.consulta_numeros_reminder_logs
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Service can insert reminder logs"
ON public.consulta_numeros_reminder_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Insert default config row
INSERT INTO public.consulta_numeros_reminder_config (is_active) VALUES (false);

-- Trigger for updated_at
CREATE TRIGGER update_consulta_numeros_reminder_config_updated_at
BEFORE UPDATE ON public.consulta_numeros_reminder_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();