-- Adicionar permissões granulares para as abas do módulo de Cobrança
INSERT INTO system_permissions (key, name, description, category) VALUES
  -- Abas do módulo de Cobrança
  ('view_cobranca_metricas', 'Visualizar Métricas de Cobrança', 'Permite visualizar a aba de métricas no módulo de cobrança', 'cobranca'),
  ('view_cobranca_recuperacao', 'Visualizar Recuperação', 'Permite visualizar a aba de recuperação de clientes inadimplentes', 'cobranca'),
  ('view_cobranca_config', 'Visualizar Configurações de Cobrança', 'Permite visualizar a aba de configurações do sistema de cobrança', 'cobranca'),
  ('view_cobranca_pagamentos', 'Visualizar Pagamentos', 'Permite visualizar a aba de configuração de pagamentos (MP, Stripe, PIX)', 'cobranca'),
  ('view_cobranca_ia', 'Visualizar IA de Cobrança', 'Permite visualizar a aba de configuração de IA para geração de mensagens', 'cobranca'),
  ('view_cobranca_canais', 'Visualizar Canais de Cobrança', 'Permite visualizar a aba de configuração de canais (Email, WhatsApp)', 'cobranca'),
  ('view_cobranca_mensagens', 'Visualizar Mensagens de Cobrança', 'Permite visualizar a aba de templates de mensagens', 'cobranca'),
  ('view_cobranca_recibo', 'Visualizar Recibo', 'Permite visualizar a aba de configuração de recibos', 'cobranca'),
  ('view_cobranca_relatorios', 'Visualizar Relatórios de Cobrança', 'Permite visualizar a aba de relatórios', 'cobranca'),
  ('view_cobranca_logs', 'Visualizar Logs de Cobrança', 'Permite visualizar a aba de logs/histórico de cobranças', 'cobranca')
ON CONFLICT (key) DO NOTHING;