-- Table for storing recovery configuration (Gmail credentials, etc.)
CREATE TABLE public.recovery_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key text UNIQUE NOT NULL,
    config_value text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recovery_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage recovery config
CREATE POLICY "Admins can manage recovery config"
ON public.recovery_config
FOR ALL
USING (is_admin());

-- Table for WhatsApp instances (Evolution API)
CREATE TABLE public.whatsapp_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_name text NOT NULL,
    api_url text NOT NULL,
    api_key text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Only admins can manage WhatsApp instances
CREATE POLICY "Admins can manage whatsapp instances"
ON public.whatsapp_instances
FOR ALL
USING (is_admin());

-- Table for password recovery logs/audit
CREATE TABLE public.password_recovery_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email text NOT NULL,
    recovery_method text NOT NULL,
    whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id),
    sent_by uuid NOT NULL,
    status text NOT NULL DEFAULT 'sent',
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_recovery_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view and insert recovery logs
CREATE POLICY "Admins can view recovery logs"
ON public.password_recovery_logs
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can insert recovery logs"
ON public.password_recovery_logs
FOR INSERT
WITH CHECK (is_admin());

-- Trigger for updated_at on recovery_config
CREATE TRIGGER update_recovery_config_updated_at
BEFORE UPDATE ON public.recovery_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on whatsapp_instances
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();