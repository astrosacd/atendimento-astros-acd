-- Add retry window configuration column
ALTER TABLE public.consulta_numeros_reminder_config
ADD COLUMN IF NOT EXISTS retry_window_minutes INTEGER NOT NULL DEFAULT 5;