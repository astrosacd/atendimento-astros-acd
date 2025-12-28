-- Adicionar permissão de Relatórios
INSERT INTO system_permissions (key, name, description, category) VALUES
('view_reports', 'Visualizar Relatórios', 'Permite visualizar relatórios avançados de conversão, churn e LTV', 'Relatórios'),
('view_guia_relatorios', 'Ver Guia de Relatórios', 'Permite visualizar a seção de Relatórios no Guia', 'Guia');

-- Dar permissão de relatórios para admin
INSERT INTO role_permissions (role_name, permission_key) VALUES
('admin', 'view_reports'),
('admin', 'view_guia_relatorios')
ON CONFLICT DO NOTHING;