
INSERT INTO public.system_permissions (key, name, category)
VALUES 
  ('view_payment_links', 'Visualizar Link de Pagamento', 'Link de Pagamento'),
  ('generate_payment_links', 'Gerar Link de Pagamento', 'Link de Pagamento'),
  ('share_payment_links', 'Gerar Link Temporário', 'Link de Pagamento')
ON CONFLICT (key) DO NOTHING;
