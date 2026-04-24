INSERT INTO public.system_permissions (key, name, description, category)
VALUES (
  'manage_predefined_products',
  'Gerenciar Produtos Predefinidos',
  'Permite adicionar, editar e excluir produtos da lista padronizada do sistema.',
  'admin'
) ON CONFLICT (key) DO NOTHING;