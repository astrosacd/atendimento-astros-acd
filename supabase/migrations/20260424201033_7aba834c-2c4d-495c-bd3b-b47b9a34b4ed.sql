-- Atualiza a descrição/categoria da permissão para melhor exibição
UPDATE public.system_permissions
SET 
  name = 'Gerenciar Produtos Predefinidos',
  description = 'Permite acessar e gerenciar a lista de produtos predefinidos (Mensal, Registro e Pipeline) usados nos formulários de cadastro.',
  category = 'admin'
WHERE key = 'manage_predefined_products';

-- Garante que o cargo admin tenha essa permissão por padrão
INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'manage_predefined_products')
ON CONFLICT (role_name, permission_key) DO NOTHING;
