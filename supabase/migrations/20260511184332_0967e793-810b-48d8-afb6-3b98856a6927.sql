-- Add create ticket permission
INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('chamados.create', 'Criar Chamados Internos', 'Permite abrir novos chamados internos no painel administrativo', 'Chamados')
ON CONFLICT (key) DO NOTHING;

-- Also add the 'create_chamados' version if following the underscore pattern seen elsewhere
INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('create_chamados', 'Criar Chamados Internos', 'Permite abrir novos chamados internos no painel administrativo', 'Chamados')
ON CONFLICT (key) DO NOTHING;