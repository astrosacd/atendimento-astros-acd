-- Insert new permissions for Status de Números
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
  ('restore_numeros_aquecimento', 'Restaurar Números', 'Permite restaurar números que foram banidos ou excluídos.', 'Status de Números'),
  ('return_to_stock_numeros', 'Voltar para o Estoque', 'Permite retornar números vendidos de volta para o estoque.', 'Status de Números'),
  ('delete_sold_numeros_permanent', 'Excluir Vendidos Permanente', 'Permite excluir permanentemente números que já foram vendidos.', 'Status de Números')
ON CONFLICT (key) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Assign these permissions to admin role by default if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.custom_roles WHERE name = 'admin') THEN
    INSERT INTO public.role_permissions (role_name, permission_key)
    VALUES 
      ('admin', 'restore_numeros_aquecimento'),
      ('admin', 'return_to_stock_numeros'),
      ('admin', 'delete_sold_numeros_permanent')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;