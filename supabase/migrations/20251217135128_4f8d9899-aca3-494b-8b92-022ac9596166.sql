-- Add exit message column to welcome_config table (reuse same table with type distinction)
ALTER TABLE public.divulgador_welcome_config 
ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'join';

-- Add comment explaining message_type values: 'join' (entrada) or 'leave' (saída)
COMMENT ON COLUMN public.divulgador_welcome_config.message_type IS 'join = entrada, leave = saída';