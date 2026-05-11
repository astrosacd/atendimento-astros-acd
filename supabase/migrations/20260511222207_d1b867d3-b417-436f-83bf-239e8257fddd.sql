ALTER TABLE public.proposal_send_config 
ADD COLUMN IF NOT EXISTS tts_text TEXT,
ADD COLUMN IF NOT EXISTS ghost_mode_type TEXT DEFAULT 'fixed'; -- 'fixed' or 'dynamic'

COMMENT ON COLUMN public.proposal_send_config.tts_text IS 'Template text for ElevenLabs TTS with support for {{nome_cliente}} placeholder';
COMMENT ON COLUMN public.proposal_send_config.ghost_mode_type IS 'Defines if the ghost audio is fixed (pre-uploaded) or dynamic (generated on-the-fly via ElevenLabs)';
