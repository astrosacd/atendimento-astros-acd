-- Add specific_media_id to ig_auto_reply_rules
ALTER TABLE public.ig_auto_reply_rules 
ADD COLUMN IF NOT EXISTS specific_media_id TEXT;

-- Index for performance when matching webhooks
CREATE INDEX IF NOT EXISTS idx_ig_auto_reply_rules_media_id ON public.ig_auto_reply_rules(specific_media_id);
