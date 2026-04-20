INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('view_client_graph', 'Visualizar Grafo de Conexões 360°', 'Permite acessar o Mapa de Conexões 360° do cliente', 'clientes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
SELECT DISTINCT role_name, 'view_client_graph'
FROM public.role_permissions
WHERE permission_key = 'view_clients'
ON CONFLICT DO NOTHING;