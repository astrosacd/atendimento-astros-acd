-- Create temporary access tokens table
CREATE TABLE public.temporary_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    target_path TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    max_uses INTEGER DEFAULT NULL,
    uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.temporary_access_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for temporary_access_tokens
CREATE POLICY "Users can manage their own temporary tokens"
ON public.temporary_access_tokens
FOR ALL
USING (auth.uid() = created_by);

CREATE POLICY "Public can view valid tokens"
ON public.temporary_access_tokens
FOR SELECT
USING (is_active = TRUE AND expires_at > now() AND (max_uses IS NULL OR uses < max_uses));

-- Insert Instagram Permissions
INSERT INTO public.system_permissions (key, name, description, category) VALUES
('view_instagram', 'Visualizar Módulo Instagram', 'Permite acessar o módulo do Instagram', 'Social Media'),
('create_instagram_post', 'Criar Posts no Instagram', 'Permite criar e agendar publicações', 'Social Media'),
('manage_instagram_settings', 'Configurar Instagram', 'Permite alterar credenciais da API Meta', 'Social Media'),
('view_instagram_history', 'Ver Histórico Instagram', 'Permite visualizar logs e histórico de posts', 'Social Media'),
('manage_temporary_access', 'Gerenciar Acesso Provisório', 'Permite criar links de acesso temporário', 'admin');

-- Update Guide Permissions if not exists
INSERT INTO public.system_permissions (key, name, description, category) VALUES
('view_guia_instagram', 'Visualizar Guia do Instagram', 'Permite ver o guia de configuração do Instagram', 'Guia')
ON CONFLICT (key) DO NOTHING;
