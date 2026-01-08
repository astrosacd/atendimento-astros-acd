-- Add restore_numeros_aquecimento permission to system_permissions
INSERT INTO system_permissions (key, name, description, category)
VALUES (
  'restore_numeros_aquecimento',
  'Restaurar Números',
  'Permite restaurar números que foram excluídos',
  'Status de Números'
)
ON CONFLICT (key) DO NOTHING;

-- Add permission to admin role
INSERT INTO role_permissions (role_name, permission_key)
SELECT 'admin', 'restore_numeros_aquecimento'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role_name = 'admin' AND permission_key = 'restore_numeros_aquecimento'
);