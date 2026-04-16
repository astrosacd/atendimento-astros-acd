-- Create table for Chatwoot configuration
CREATE TABLE public.pipeline_chatwoot_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    chatwoot_url TEXT,
    chatwoot_api_key TEXT,
    account_id TEXT,
    inbox_id TEXT,
    enabled BOOLEAN DEFAULT false,
    sync_conversations BOOLEAN DEFAULT false,
    sync_leads BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_chatwoot_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own chatwoot config" 
ON public.pipeline_chatwoot_config 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can update chatwoot config" 
ON public.pipeline_chatwoot_config 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can insert chatwoot config" 
ON public.pipeline_chatwoot_config 
FOR INSERT 
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pipeline_chatwoot_config_updated_at
BEFORE UPDATE ON public.pipeline_chatwoot_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default empty config if not exists
INSERT INTO public.pipeline_chatwoot_config (enabled) VALUES (false);
