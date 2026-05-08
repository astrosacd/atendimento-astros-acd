UPDATE public.system_permissions
SET category = 'Segurança de Pagamento',
    name = 'Visualizar Segurança de Pagamento',
    description = 'Permite acessar o módulo de segurança e validação de pagamentos'
WHERE key = 'view_payment_security';

UPDATE public.system_permissions
SET category = 'Segurança de Pagamento'
WHERE key = 'register_pixpague_payment';
