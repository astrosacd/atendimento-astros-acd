-- Add RCS permissions to system_permissions
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
    ('view_rcs', 'Visualizar RCS', 'Permite visualizar a aba de RCS e o histórico de mensagens', 'RCS'),
    ('manage_rcs', 'Gerenciar Envio RCS', 'Permite enviar mensagens RCS e configurar disparos', 'RCS'),
    ('manage_rcs_templates', 'Gerenciar Templates RCS', 'Permite criar, editar e excluir templates de RCS', 'RCS')
ON CONFLICT (key) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Grant permissions to admin role by default
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions WHERE category = 'RCS'
ON CONFLICT DO NOTHING;
