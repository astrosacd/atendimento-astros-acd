-- Insert Instagram permissions
INSERT INTO public.system_permissions (key, name, description, category) VALUES
('view_instagram', 'Visualizar Instagram', 'Permite acessar o módulo do Instagram', 'Instagram'),
('create_instagram_post', 'Criar Post Instagram', 'Permite criar e publicar posts no Instagram', 'Instagram'),
('manage_instagram_settings', 'Gerenciar Configurações Instagram', 'Permite alterar App ID, Secret e Tokens do Instagram', 'Instagram'),
('view_instagram_history', 'Ver Histórico Instagram', 'Permite visualizar o histórico de publicações', 'Instagram'),
('manage_temporary_access', 'Gerenciar Acesso Provisório', 'Permite criar e excluir links de acesso temporário', 'Instagram'),
('view_guia_instagram', 'Ver Guia Instagram', 'Permite visualizar o guia do Instagram no painel administrativo', 'Instagram')
ON CONFLICT (key) DO NOTHING;
