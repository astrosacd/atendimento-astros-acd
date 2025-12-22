-- Add Chamados permissions to system_permissions
INSERT INTO system_permissions (key, name, description, category) VALUES
  ('view_chamados', 'Visualizar Chamados', 'Permite visualizar a lista de chamados', 'Chamados'),
  ('manage_chamados', 'Gerenciar Chamados', 'Permite atualizar status e adicionar comentários', 'Chamados'),
  ('manage_chamados_config', 'Configurar Chamados', 'Permite alterar configurações do sistema de chamados', 'Chamados'),
  ('manage_chamados_webhooks', 'Gerenciar Webhooks de Chamados', 'Permite criar e gerenciar webhooks', 'Chamados'),
  ('manage_chamados_api', 'Gerenciar API de Chamados', 'Permite criar e gerenciar chaves de API', 'Chamados'),
  ('view_guia_chamados', 'Visualizar Guia de Chamados', 'Permite visualizar a seção de Chamados no Guia', 'Guia')
ON CONFLICT (key) DO NOTHING;

-- Grant all Chamados permissions to admin role
INSERT INTO role_permissions (role_name, permission_key)
SELECT 'admin', key FROM system_permissions WHERE category = 'Chamados'
ON CONFLICT (role_name, permission_key) DO NOTHING;

INSERT INTO role_permissions (role_name, permission_key)
VALUES ('admin', 'view_guia_chamados')
ON CONFLICT (role_name, permission_key) DO NOTHING;