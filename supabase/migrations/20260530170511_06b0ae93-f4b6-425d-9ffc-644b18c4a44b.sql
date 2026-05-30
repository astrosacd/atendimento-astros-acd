-- Add new permissions for Seguros and Scans
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
  ('view_seguros', 'Visualizar Seguros', 'Permite visualizar a aba de Seguro de Números Aquecidos', 'Seguros'),
  ('manage_seguros', 'Gerenciar Seguros', 'Permite marcar status de pagamento e gerenciar seguros', 'Seguros'),
  ('view_scans', 'Visualizar Scans', 'Permite visualizar o histórico de scans de QR Code', 'Scans'),
  ('manage_scans', 'Gerenciar Scans', 'Permite realizar scans e gerenciar o contador mensal', 'Scans'),
  ('manage_scans_config', 'Configurar Scans', 'Permite configurar limites e regras do módulo de scans', 'Scans')
ON CONFLICT (key) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;
