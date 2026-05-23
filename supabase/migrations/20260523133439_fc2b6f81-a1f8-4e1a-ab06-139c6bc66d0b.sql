INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('manage_cobranca_webhooks', 'Gerenciar Webhooks de Cobrança', 'Permite visualizar URLs, salvar o Signing Secret da Stripe e testar os webhooks de cobrança.', 'cobranca')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
SELECT r.name, 'manage_cobranca_webhooks'
FROM public.custom_roles r
WHERE r.name IN ('admin','gerente')
ON CONFLICT DO NOTHING;