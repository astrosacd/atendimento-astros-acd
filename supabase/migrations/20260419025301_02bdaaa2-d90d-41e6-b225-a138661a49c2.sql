-- Insert missing permissions
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
  ('manage_integrations', 'Gerenciar Integrações', 'Permite gerenciar conexões com serviços externos (Baserow, etc)', 'admin'),
  ('manage_consulta_numeros_reminders', 'Gerenciar Lembretes', 'Permite configurar e gerenciar lembretes de renovação de consulta', 'Consulta de Números'),
  ('view_consulta_numeros_reminder_logs', 'Visualizar Logs de Lembretes', 'Permite visualizar o histórico de disparos de lembretes', 'Consulta de Números'),
  ('view_gateway_events', 'Visualizar Eventos', 'Permite visualizar os logs de eventos e webhooks do gateway', 'Gateway'),
  ('view_gateway_coupon_usages', 'Visualizar Uso de Cupons', 'Permite visualizar o histórico de utilização de cupons de desconto', 'Gateway')
ON CONFLICT (key) DO NOTHING;
