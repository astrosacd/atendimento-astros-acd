-- Corrigir categoria da permissão view_unmasked_consulta_numeros
UPDATE public.system_permissions 
SET category = 'Consulta de Números'
WHERE key = 'view_unmasked_consulta_numeros' AND category = 'consulta_numeros';

-- Adicionar todas as permissões de Guia ao admin
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
('admin', 'view_guia'),
('admin', 'view_guia_comunicacao'),
('admin', 'view_guia_integracoes'),
('admin', 'view_guia_usuarios'),
('admin', 'view_guia_cobranca'),
('admin', 'view_guia_clientes'),
('admin', 'view_guia_divulgador'),
('admin', 'view_guia_numeros'),
('admin', 'view_guia_avancado'),
-- Adicionar permissão que estava faltando no admin
('admin', 'view_unmasked_consulta_numeros')
ON CONFLICT (role_name, permission_key) DO NOTHING;