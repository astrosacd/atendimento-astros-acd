INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('view_central_ajuda', 'Acessar Central de Ajuda', 'Permite usar a Central de Ajuda com IA para gerar respostas a clientes', 'Central de Ajuda')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'view_central_ajuda')
ON CONFLICT DO NOTHING;