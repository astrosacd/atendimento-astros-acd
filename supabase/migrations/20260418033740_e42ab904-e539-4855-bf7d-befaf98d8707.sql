-- Create client AI logs table
CREATE TABLE IF NOT EXISTS public.client_ai_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    mode TEXT NOT NULL, -- 'summary' or 'churn'
    model TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_ai_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view AI logs" 
ON public.client_ai_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert AI logs" 
ON public.client_ai_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Add permission
INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('view_client_ai', 'Visualizar Insights IA', 'Permite visualizar os insights gerados por IA para os clientes', 'clientes')
ON CONFLICT (key) DO NOTHING;

-- Grant to admin
INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'view_client_ai')
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_ai_logs_cliente_id ON public.client_ai_logs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_client_ai_logs_created_at ON public.client_ai_logs(created_at);