ALTER TABLE public.billing_logs ADD COLUMN IF NOT EXISTS cliente_produto TEXT;
ALTER TABLE public.billing_logs ADD COLUMN IF NOT EXISTS cliente_observacoes TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_logs TO authenticated;
GRANT ALL ON public.billing_logs TO service_role;