-- Update categories for existing instagram permissions
UPDATE public.system_permissions 
SET category = 'Instagram' 
WHERE key IN ('view_instagram', 'create_instagram_post', 'manage_instagram_settings', 'view_instagram_history', 'view_guia_instagram');

-- Insert or update manage_temporary_access
INSERT INTO public.system_permissions (key, name, description, category) VALUES
('manage_temporary_access', 'Gerenciar Acesso Provisório', 'Permite criar e excluir links de acesso temporário', 'Instagram')
ON CONFLICT (key) DO UPDATE SET category = 'Instagram';
