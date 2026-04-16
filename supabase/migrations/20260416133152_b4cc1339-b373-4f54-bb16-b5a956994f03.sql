INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
    ('manage_pipeline_chatwoot', 'Gerenciar Integração Chatwoot', 'Permite configurar a integração com o Chatwoot no Pipeline', 'CRM'),
    ('share_pipeline', 'Compartilhar Pipeline', 'Permite gerar links de acesso temporário para o Pipeline', 'CRM')
ON CONFLICT (key) DO NOTHING;
