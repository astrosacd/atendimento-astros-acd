
INSERT INTO system_permissions (key, name, description, category) VALUES
  ('view_guia_gateway', 'Guia - Gateway', 'Acesso ao guia do módulo Gateway', 'Guia'),
  ('view_guia_propostas', 'Guia - Propostas', 'Acesso ao guia do módulo Propostas', 'Guia'),
  ('view_guia_followups', 'Guia - Follow-ups', 'Acesso ao guia do módulo Follow-ups', 'Guia'),
  ('view_guia_despesas', 'Guia - Despesas', 'Acesso ao guia do módulo Despesas', 'Guia'),
  ('view_guia_revendedor', 'Guia - Revendedor', 'Acesso ao guia do módulo Revendedor', 'Guia'),
  ('view_guia_tarefas', 'Guia - Tarefas', 'Acesso ao guia de Tarefas', 'Guia'),
  ('view_guia_pipeline', 'Guia - Pipeline', 'Acesso ao guia do módulo Pipeline', 'Guia'),
  ('view_guia_lead_hunter', 'Guia - Lead Hunter', 'Acesso ao guia do módulo Lead Hunter', 'Guia'),
  ('view_guia_agenda', 'Guia - Agenda', 'Acesso ao guia do módulo Agenda', 'Guia'),
  ('view_guia_link_pagamento', 'Guia - Link de Pagamento', 'Acesso ao guia do Gerador de Link de Pagamento', 'Guia')
ON CONFLICT (key) DO NOTHING;
