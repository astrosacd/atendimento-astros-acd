-- Add view_proposals_dashboard permission
INSERT INTO system_permissions (key, name, description, category)
VALUES ('view_proposals_dashboard', 'Ver Propostas no Dashboard', 'Permite visualizar as estatísticas de propostas no dashboard principal', 'propostas')
ON CONFLICT (key) DO NOTHING;

-- Grant to admin role
INSERT INTO role_permissions (role_name, permission_key)
VALUES ('admin', 'view_proposals_dashboard')
ON CONFLICT (role_name, permission_key) DO NOTHING;