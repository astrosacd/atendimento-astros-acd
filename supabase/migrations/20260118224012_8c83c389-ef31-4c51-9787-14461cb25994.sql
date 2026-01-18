-- Adicionar permissões para Despesas
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_despesas', 'Visualizar Despesas', 'Permite acessar e visualizar o módulo de despesas', 'Despesas'),
  ('manage_despesas', 'Gerenciar Despesas', 'Permite criar, editar e excluir despesas', 'Despesas'),
  ('manage_despesas_cron', 'Gerenciar Cron de Despesas', 'Permite configurar a geração automática de despesas recorrentes', 'Despesas')
ON CONFLICT (key) DO NOTHING;