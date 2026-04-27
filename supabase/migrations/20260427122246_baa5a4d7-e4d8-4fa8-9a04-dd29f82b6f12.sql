-- Adiciona coluna de última atividade nas sessões para permitir reaproveitamento
ALTER TABLE public.user_login_history
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Índice para acelerar busca de sessão ativa por dispositivo
CREATE INDEX IF NOT EXISTS idx_user_login_history_active_device
ON public.user_login_history (user_id, browser, os, device_name, is_active);