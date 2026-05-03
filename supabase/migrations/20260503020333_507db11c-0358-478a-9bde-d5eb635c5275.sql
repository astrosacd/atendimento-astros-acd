INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('view_sala_agentes', 'Visualizar Sala dos Agentes', 'Acesso à visualização 3D da Sala dos Agentes', 'Sala dos Agentes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'view_sala_agentes')
ON CONFLICT DO NOTHING;