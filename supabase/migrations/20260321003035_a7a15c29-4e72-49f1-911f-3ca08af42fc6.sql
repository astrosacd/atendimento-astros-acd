-- Add Lead Hunter permissions
INSERT INTO system_permissions (key, name, description, category) VALUES
  ('view_lead_hunter', 'Visualizar Lead Hunter', 'Permite visualizar o módulo Lead Hunter', 'Lead Hunter'),
  ('manage_lead_hunter_leads', 'Gerenciar Leads', 'Permite criar, editar e excluir leads', 'Lead Hunter'),
  ('manage_lead_hunter_campanhas', 'Gerenciar Campanhas', 'Permite criar e gerenciar campanhas de disparo', 'Lead Hunter'),
  ('manage_lead_hunter_config', 'Gerenciar Configurações', 'Permite configurar APIs, WhatsApp e IA', 'Lead Hunter'),
  ('manage_lead_hunter_baserow', 'Gerenciar Baserow', 'Permite configurar integração Baserow do Lead Hunter', 'Lead Hunter'),
  ('view_lead_hunter_historico', 'Visualizar Histórico', 'Permite visualizar histórico de disparos', 'Lead Hunter'),
  ('manage_lead_hunter_busca', 'Gerenciar Busca SERP', 'Permite realizar buscas no Google Maps via SERP', 'Lead Hunter')
ON CONFLICT (key) DO NOTHING;

-- Add manage_billing_baserow if missing
INSERT INTO system_permissions (key, name, description, category) VALUES
  ('manage_billing_baserow', 'Gerenciar Baserow Cobrança', 'Permite configurar integração Baserow da Cobrança', 'Cobrança')
ON CONFLICT (key) DO NOTHING;