INSERT INTO system_permissions (key, name, description, category)
VALUES 
  ('view_billing_history_quick', 'Acesso Rápido ao Histórico', 'Permite visualizar o botão de histórico de cobrança no Dashboard', 'cobranca'),
  ('view_central_sms', 'Visualizar Central de SMS', 'Permite acessar o módulo de Central de SMS', 'Central SMS'),
  ('manage_whatsapp_instances', 'Gerenciar Instâncias WhatsApp', 'Permite configurar e gerenciar instâncias do WhatsApp', 'Status de Números')
ON CONFLICT (key) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Garantir que admins tenham essas permissões por padrão
INSERT INTO role_permissions (role_name, permission_key)
SELECT 'admin', p.key 
FROM system_permissions p 
WHERE p.key IN ('view_billing_history_quick', 'view_central_sms', 'manage_whatsapp_instances')
ON CONFLICT DO NOTHING;