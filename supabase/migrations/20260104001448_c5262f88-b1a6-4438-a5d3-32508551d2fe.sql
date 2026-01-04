-- Adicionar colunas para intervalo em minutos e minutos de início/fim
ALTER TABLE public.consulta_numeros_reminder_config
ADD COLUMN IF NOT EXISTS cron_interval_minutes integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS cron_start_minute integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cron_end_minute integer DEFAULT 0;

-- Migrar dados existentes: converter horas para minutos
UPDATE public.consulta_numeros_reminder_config
SET cron_interval_minutes = cron_interval_hours * 60
WHERE cron_interval_minutes = 60 OR cron_interval_minutes IS NULL;