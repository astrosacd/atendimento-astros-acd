INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('finalize_whatsapp_groups', 'Finalizar Projetos WhatsApp', 'Permite finalizar projetos de grupos WhatsApp', 'Clientes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'finalize_whatsapp_groups')
ON CONFLICT (role_name, permission_key) DO NOTHING;