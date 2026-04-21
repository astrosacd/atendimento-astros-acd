-- Add new permission to control who can register PixPague (early/manual PIX) payments from the client payment history
INSERT INTO public.system_permissions (key, name, description, category)
VALUES (
  'register_pixpague_payment',
  'Registrar Pagamento PixPague',
  'Permite ao usuário enviar comprovantes PIX antecipados para aprovação no módulo Segurança de Pagamento',
  'Financeiro'
)
ON CONFLICT (key) DO NOTHING;

-- Grant the new permission to admin role by default
INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'register_pixpague_payment')
ON CONFLICT DO NOTHING;