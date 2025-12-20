-- Add customer_cpf column to gateway_orders
ALTER TABLE public.gateway_orders
ADD COLUMN customer_cpf TEXT NULL;