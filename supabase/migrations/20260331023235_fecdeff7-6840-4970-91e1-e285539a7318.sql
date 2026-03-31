-- Ensure SMS validation permissions exist in system_permissions
INSERT INTO public.system_permissions (key, name, description, category)
VALUES
  ('view_validacao_sms', 'Visualizar Validação SMS', 'Permite visualizar e usar a validação SMS', 'Consulta de Números'),
  ('share_validacao_sms', 'Compartilhar Validação SMS', 'Permite gerar links temporários de acesso à validação SMS', 'Consulta de Números')
ON CONFLICT (key) DO NOTHING;