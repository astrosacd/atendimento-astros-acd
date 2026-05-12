-- Create table for TTS logs
CREATE TABLE IF NOT EXISTS public.proposal_tts_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL, -- 'success' or 'error'
    action TEXT NOT NULL, -- 'generate' or 'list_voices'
    text_preview TEXT,
    voice_id TEXT,
    error_details JSONB,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_tts_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tts logs" 
ON public.proposal_tts_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert tts logs" 
ON public.proposal_tts_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL); -- Allow service role or user

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_proposal_tts_logs_user_id ON public.proposal_tts_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_tts_logs_created_at ON public.proposal_tts_logs(created_at DESC);
