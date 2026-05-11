ALTER TABLE public.proposal_send_config
ADD COLUMN IF NOT EXISTS ghost_mode_day INTEGER DEFAULT 3;
