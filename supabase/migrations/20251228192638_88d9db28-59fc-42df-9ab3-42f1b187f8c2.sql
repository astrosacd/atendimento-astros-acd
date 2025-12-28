-- Add Revendedor permissions to system_permissions
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
  ('view_revendedor', 'Visualizar Revendedor', 'Visualizar módulo Revendedor', 'Revendedor'),
  ('manage_revendedor_planos', 'Gerenciar Planos', 'Gerenciar planos de revendedor', 'Revendedor'),
  ('manage_revendedor_licencas', 'Gerenciar Licenças', 'Gerenciar licenças de revendedor', 'Revendedor')
ON CONFLICT (key) DO NOTHING;

-- Add permissions to admin role
INSERT INTO public.role_permissions (role_name, permission_key) 
VALUES 
  ('admin', 'view_revendedor'),
  ('admin', 'manage_revendedor_planos'),
  ('admin', 'manage_revendedor_licencas')
ON CONFLICT DO NOTHING;