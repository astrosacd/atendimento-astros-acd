-- Primeiro inserir a permissão no sistema
INSERT INTO system_permissions (key, name, description, category)
VALUES (
  'delete_sold_numeros', 
  'Excluir Números Vendidos', 
  'Permite excluir números que já foram vendidos',
  'numeros_aquecimento'
)
ON CONFLICT (key) DO NOTHING;

-- Depois adicionar para o role admin
INSERT INTO role_permissions (role_name, permission_key)
SELECT 'admin', 'delete_sold_numeros'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role_name = 'admin' AND permission_key = 'delete_sold_numeros'
);