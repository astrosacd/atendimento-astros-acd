-- Create table for alert/reminder configuration for numeros aquecimento
CREATE TABLE public.numeros_aquecimento_alert_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT false,
    -- Status to monitor (array of status IDs)
    status_to_monitor UUID[] NOT NULL DEFAULT '{}',
    -- Interval configuration
    alert_interval_hours INTEGER NOT NULL DEFAULT 2,
    alert_interval_minutes INTEGER NOT NULL DEFAULT 0,
    -- Message template
    message_template TEXT DEFAULT 'Atenção! Existem {count} número(s) com status que requerem ação.',
    -- Last alert sent
    last_alert_at TIMESTAMPTZ,
    -- Created/Updated timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.numeros_aquecimento_alert_config ENABLE ROW LEVEL SECURITY;

-- Create policies - only authenticated users with proper permissions can access
CREATE POLICY "Authenticated users can view alert config"
ON public.numeros_aquecimento_alert_config
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert alert config"
ON public.numeros_aquecimento_alert_config
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update alert config"
ON public.numeros_aquecimento_alert_config
FOR UPDATE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_numeros_aquecimento_alert_config_updated_at
BEFORE UPDATE ON public.numeros_aquecimento_alert_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config row
INSERT INTO public.numeros_aquecimento_alert_config (is_active, status_to_monitor, alert_interval_hours)
VALUES (false, '{}', 2);