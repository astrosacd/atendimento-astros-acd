INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('view_bi_metrics', 'Visualizar Inteligência de Negócio', 'Permite ver métricas de CAC, LTV, Payback e ARPU', 'Relatórios'),
  ('manage_marketing_expenses', 'Gerenciar Gastos de Marketing', 'Permite registrar e editar investimentos de marketing usados no cálculo do CAC', 'Relatórios')
ON CONFLICT (key) DO NOTHING;