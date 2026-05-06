INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
('view_instagram_reports', 'Visualizar Relatórios do Instagram', 'Permite visualizar métricas e desempenho das postagens do Instagram', 'Instagram')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.billing_config (config_key, config_value)
VALUES ('instagram_renewal_webhook', '')
ON CONFLICT (config_key) DO NOTHING;
