-- Inserir novas permissões de sistema
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
    -- Aprovações
    ('view_approvals', 'Visualizar Aprovações', 'Permite visualizar o histórico e solicitações de aprovação', 'Aprovações'),
    ('manage_approvals', 'Gerenciar Aprovações', 'Permite aprovar ou rejeitar solicitações pendentes', 'Aprovações'),
    
    -- Automações
    ('view_automations', 'Visualizar Automações', 'Permite visualizar as regras de automação do sistema', 'Automações'),
    ('manage_automations', 'Gerenciar Automações', 'Permite criar, editar e excluir regras de automação', 'Automações'),
    ('view_automation_logs', 'Visualizar Logs de Automação', 'Permite visualizar o histórico de execução das automações', 'Automações'),
    
    -- Chat
    ('view_chat', 'Visualizar Chat', 'Permite acessar o chat interno e visualizar conversas', 'Chat'),
    ('manage_chat', 'Gerenciar Chat', 'Permite iniciar conversas e gerenciar mensagens', 'Chat'),
    
    -- Vendas
    ('view_sales_forecast', 'Visualizar Previsão de Vendas', 'Permite visualizar as previsões e metas de vendas', 'Vendas'),
    ('manage_sales_forecast', 'Gerenciar Previsão de Vendas', 'Permite criar e atualizar previsões de vendas', 'Vendas'),
    
    -- Conexões
    ('view_whatsapp_instances', 'Visualizar Instâncias WhatsApp', 'Permite visualizar as instâncias globais do WhatsApp', 'Conexões'),
    ('manage_whatsapp_instances', 'Gerenciar Instâncias WhatsApp', 'Permite criar, editar e excluir instâncias globais do WhatsApp', 'Conexões'),
    
    -- Social Media
    ('share_social_credentials', 'Compartilhar Credenciais', 'Permite gerar links de acesso temporário para credenciais', 'Social Media'),
    
    -- Admin
    ('manage_integrations', 'Gerenciar Integrações', 'Permite gerenciar conexões com serviços externos (Baserow, etc)', 'admin'),
    
    -- Consulta de Números
    ('manage_consulta_numeros_reminders', 'Gerenciar Lembretes', 'Permite configurar lembretes automáticos de consulta', 'Consulta de Números'),
    ('view_consulta_numeros_reminder_logs', 'Visualizar Logs de Lembretes', 'Permite visualizar o histórico de disparos de lembretes', 'Consulta de Números'),
    
    -- Gateway
    ('view_gateway_events', 'Visualizar Eventos do Gateway', 'Permite visualizar os webhooks e eventos recebidos do gateway', 'Gateway'),
    ('view_gateway_coupon_usages', 'Visualizar Uso de Cupons', 'Permite visualizar o histórico de utilização de cupons', 'Gateway')
ON CONFLICT (key) DO NOTHING;

-- Atribuir novas permissões ao papel de administrador (admin)
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'admin', key FROM public.system_permissions
WHERE key IN (
    'view_approvals', 'manage_approvals',
    'view_automations', 'manage_automations', 'view_automation_logs',
    'view_chat', 'manage_chat',
    'view_sales_forecast', 'manage_sales_forecast',
    'view_whatsapp_instances', 'manage_whatsapp_instances',
    'share_social_credentials',
    'manage_integrations',
    'manage_consulta_numeros_reminders', 'view_consulta_numeros_reminder_logs',
    'view_gateway_events', 'view_gateway_coupon_usages'
)
ON CONFLICT (role_name, permission_key) DO NOTHING;
