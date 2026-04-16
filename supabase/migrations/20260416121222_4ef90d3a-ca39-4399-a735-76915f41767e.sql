ALTER TABLE public.client_pipeline 
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_score_reason TEXT,
ADD COLUMN IF NOT EXISTS next_action_suggestion TEXT,
ADD COLUMN IF NOT EXISTS last_ai_update TIMESTAMP WITH TIME ZONE;

-- Also add columns to help AI analysis
ALTER TABLE public.client_pipeline
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now();
