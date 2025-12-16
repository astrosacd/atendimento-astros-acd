-- Add Divulgador permissions to system_permissions
INSERT INTO public.system_permissions (key, name, description, category) VALUES
('view_divulgador', 'Visualizar Divulgador', 'Permite visualizar o módulo Divulgador Interno', 'divulgador'),
('manage_divulgador_config', 'Gerenciar Configuração', 'Permite configurar instância WhatsApp do Divulgador', 'divulgador'),
('manage_divulgador_campaigns', 'Gerenciar Campanhas', 'Permite criar e gerenciar campanhas de grupos', 'divulgador'),
('manage_divulgador_groups', 'Gerenciar Grupos', 'Permite criar e gerenciar grupos de WhatsApp', 'divulgador'),
('manage_divulgador_messages', 'Gerenciar Mensagens', 'Permite agendar e enviar mensagens em massa', 'divulgador'),
('manage_divulgador_participants', 'Gerenciar Participantes', 'Permite adicionar e remover participantes', 'divulgador'),
('view_divulgador_reports', 'Visualizar Relatórios', 'Permite visualizar relatórios do Divulgador', 'divulgador')
ON CONFLICT (key) DO NOTHING;

-- Grant all Divulgador permissions to admin role
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions WHERE category = 'divulgador'
ON CONFLICT DO NOTHING;