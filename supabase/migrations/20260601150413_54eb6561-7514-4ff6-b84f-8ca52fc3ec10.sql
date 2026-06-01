-- Adicionar Messaging Service SID para RCS via Twilio
INSERT INTO public.ligacoes_ia_config (config_key, config_value) 
VALUES ('twilio_messaging_service_sid', '')
ON CONFLICT (config_key) DO NOTHING;

-- Atualizar rcs_sessions para suportar provedores variados
ALTER TABLE public.rcs_sessions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'android';
ALTER TABLE public.rcs_sessions ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}'::jsonb;

-- Garantir GRANTs para as tabelas relacionadas a RCS (caso falte)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcs_sessions TO authenticated;
GRANT ALL ON public.rcs_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcs_messages TO authenticated;
GRANT ALL ON public.rcs_messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcs_templates TO authenticated;
GRANT ALL ON public.rcs_templates TO service_role;
