-- Add permissions to temporary_access_tokens
ALTER TABLE public.temporary_access_tokens 
ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY['create', 'history'];

-- Add follow-up message for non-followers to auto-reply rules
ALTER TABLE public.ig_auto_reply_rules 
ADD COLUMN IF NOT EXISTS non_follower_response TEXT;

-- Update the linter security check by ensuring the search path is set for any modified functions if they were recreated
-- (Already handled in previous migration for the core function)
