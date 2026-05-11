ALTER TABLE public.proposal_send_config 
ADD COLUMN IF NOT EXISTS elevenlabs_api_key text,
ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text DEFAULT 'JBFqnCBsd6RMkjVDRZzb';