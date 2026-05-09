-- Create ig_auto_reply_rules table
CREATE TABLE IF NOT EXISTS public.ig_auto_reply_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    
    -- Filters
    media_type TEXT, -- feed, reels, all
    keywords TEXT[], -- keywords to match
    follower_only BOOLEAN DEFAULT false,
    
    -- Actions
    public_response TEXT,
    dm_response TEXT,
    
    -- Limits/Config
    delay_seconds INTEGER DEFAULT 0,
    daily_limit INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ig_auto_reply_history table
CREATE TABLE IF NOT EXISTS public.ig_auto_reply_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.ig_auto_reply_rules(id) ON DELETE SET NULL,
    
    -- Meta Info
    ig_comment_id TEXT NOT NULL,
    ig_media_id TEXT,
    ig_username TEXT,
    ig_user_id TEXT,
    comment_text TEXT,
    
    -- Actions taken
    public_response_sent BOOLEAN DEFAULT false,
    dm_sent BOOLEAN DEFAULT false,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ig_auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_auto_reply_history ENABLE ROW LEVEL SECURITY;

-- Create policies for ig_auto_reply_rules
CREATE POLICY "Users can manage their own auto-reply rules" 
ON public.ig_auto_reply_rules 
FOR ALL 
USING (auth.uid() = user_id);

-- Create policies for ig_auto_reply_history
CREATE POLICY "Users can view their own auto-reply history" 
ON public.ig_auto_reply_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert auto-reply history" 
ON public.ig_auto_reply_history 
FOR INSERT 
WITH CHECK (true); -- Allow system/webhook to insert

-- Add webhook config to instagram_settings if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instagram_settings' AND column_name = 'webhook_verify_token') THEN
        ALTER TABLE public.instagram_settings ADD COLUMN webhook_verify_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instagram_settings' AND column_name = 'auto_reply_enabled') THEN
        ALTER TABLE public.instagram_settings ADD COLUMN auto_reply_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create update_updated_at_column function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for ig_auto_reply_rules
CREATE TRIGGER update_ig_auto_reply_rules_updated_at
BEFORE UPDATE ON public.ig_auto_reply_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
