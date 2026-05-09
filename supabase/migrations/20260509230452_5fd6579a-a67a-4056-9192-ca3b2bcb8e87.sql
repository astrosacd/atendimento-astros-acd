-- Insert Instagram permissions if they don't exist
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
  ('ver_instagram', 'Ver Módulo Instagram', 'Permite acessar o módulo do Instagram', 'Instagram'),
  ('criar_post_instagram', 'Criar Post Instagram', 'Permite criar e agendar publicações no Instagram', 'Instagram'),
  ('gerenciar_auto_resposta_instagram', 'Gerenciar Auto-Resposta', 'Permite configurar regras de auto-resposta no Instagram', 'Instagram'),
  ('ver_historico_instagram', 'Ver Histórico Instagram', 'Permite visualizar o histórico de interações e postagens', 'Instagram'),
  ('gerenciar_configuracoes_instagram', 'Configurações Instagram', 'Permite gerenciar credenciais e tokens da API Meta', 'Instagram'),
  ('gerenciar_acesso_provisorio_instagram', 'Gerenciar Acesso Provisório', 'Permite criar e excluir links de acesso temporário para o módulo', 'Instagram')
ON CONFLICT (key) DO NOTHING;