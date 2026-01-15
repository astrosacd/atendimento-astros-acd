-- Add view_proposal_history permission
INSERT INTO system_permissions (key, name, description, category)
VALUES ('view_proposal_history', 'Ver Histórico de Propostas', 'Permite visualizar o histórico de ações das propostas', 'propostas')
ON CONFLICT (key) DO NOTHING;

-- Grant to admin role
INSERT INTO role_permissions (role_name, permission_key)
VALUES ('admin', 'view_proposal_history')
ON CONFLICT (role_name, permission_key) DO NOTHING;