INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('manage_instagram_espionage', 'Gerenciar Espionagem Instagram', 'Permite acessar e gerenciar a aba de Espionagem (concorrentes, análises e configurações)', 'Instagram')
ON CONFLICT (key) DO NOTHING;