-- Add view_count to track proposal interactions
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Update remarketing logs to track more details
ALTER TABLE public.proposal_auto_remarketing_logs 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT; -- 'audio', 'video'

-- Add ghost mode settings to config
ALTER TABLE public.proposal_send_config
ADD COLUMN IF NOT EXISTS ghost_mode_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ghost_view_threshold INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS ghost_audio_url TEXT,
ADD COLUMN IF NOT EXISTS ghost_video_url TEXT;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_proposals_view_count ON public.proposals(view_count);
