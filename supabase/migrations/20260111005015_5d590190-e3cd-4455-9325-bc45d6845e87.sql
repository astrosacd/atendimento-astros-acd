-- Create table for auto-sync configuration
CREATE TABLE IF NOT EXISTS public.consulta_numeros_auto_sync_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT false,
  interval_minutes INTEGER NOT NULL DEFAULT 60,
  last_auto_sync_at TIMESTAMP WITH TIME ZONE,
  next_scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consulta_numeros_auto_sync_config ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read
CREATE POLICY "Authenticated users can read auto sync config"
ON public.consulta_numeros_auto_sync_config
FOR SELECT
TO authenticated
USING (true);

-- Policy for authenticated users to update
CREATE POLICY "Authenticated users can update auto sync config"
ON public.consulta_numeros_auto_sync_config
FOR UPDATE
TO authenticated
USING (true);

-- Policy for authenticated users to insert
CREATE POLICY "Authenticated users can insert auto sync config"
ON public.consulta_numeros_auto_sync_config
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Insert default config row
INSERT INTO public.consulta_numeros_auto_sync_config (is_active, interval_minutes)
VALUES (false, 60)
ON CONFLICT DO NOTHING;

-- Create trigger to update updated_at
CREATE TRIGGER update_consulta_numeros_auto_sync_config_updated_at
BEFORE UPDATE ON public.consulta_numeros_auto_sync_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();