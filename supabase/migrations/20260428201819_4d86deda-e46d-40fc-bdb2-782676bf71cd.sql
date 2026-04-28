INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_guia_aprovacoes', 'Guia - Aprovações', 'Permite visualizar a seção de Aprovações no Guia de Configuração', 'Guia'),
  ('view_guia_automacoes', 'Guia - Automações', 'Permite visualizar a seção de Automações no Guia de Configuração', 'Guia'),
  ('manage_cobranca_meta_templates', 'Gerenciar Meta na Cobrança', 'Permite configurar credenciais, sincronizar templates e mapear variáveis da API Oficial da Meta no módulo de Cobrança', 'cobranca'),
  ('manage_lead_hunter_meta_templates', 'Gerenciar Meta no Lead Hunter', 'Permite configurar credenciais, sincronizar templates e mapear variáveis da API Oficial da Meta no Lead Hunter', 'Lead Hunter')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key
FROM public.system_permissions
WHERE key IN (
  'view_guia_aprovacoes',
  'view_guia_automacoes',
  'manage_cobranca_meta_templates',
  'manage_lead_hunter_meta_templates'
)
ON CONFLICT (role_name, permission_key) DO NOTHING;