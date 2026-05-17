-- Adicionar permissões do módulo Ligações IA
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_ligacoes_ia', 'Ver Ligações IA', 'Acessar o módulo de Ligações com IA (histórico, ligações manuais e fila)', 'Ligações IA'),
  ('execute_ligacoes_fila', 'Executar fila de ligações', 'Iniciar, pausar e parar a fila diária de ligações automatizadas', 'Ligações IA'),
  ('manage_ligacoes_cobranca_config', 'Configurar cobrança por ligação', 'Editar a configuração de cobrança automática por ligação (D-3, D0, D+5, etc.)', 'Ligações IA'),
  ('manage_ligacoes_roteiros', 'Gerenciar roteiros de IA', 'Criar e editar os roteiros de voz da IA usados nas ligações', 'Ligações IA')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Garantir que admins (via role_permissions) recebam estas permissões automaticamente
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions
WHERE key IN ('view_ligacoes_ia','execute_ligacoes_fila','manage_ligacoes_cobranca_config','manage_ligacoes_roteiros')
ON CONFLICT DO NOTHING;