-- 1) billing_logs: guardar corpo da mensagem enviada (retrocompatível)
ALTER TABLE public.billing_logs
  ADD COLUMN IF NOT EXISTS message_body TEXT;

-- 2) client_payments: suporte a pagamento em dinheiro (total ou parcial vinculado)
ALTER TABLE public.client_payments
  ADD COLUMN IF NOT EXISTS cash_description TEXT,
  ADD COLUMN IF NOT EXISTS parent_payment_id UUID REFERENCES public.client_payments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_payments_parent_payment_id
  ON public.client_payments(parent_payment_id)
  WHERE parent_payment_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.billing_logs.message_body IS 'Texto real renderizado enviado ao cliente (WhatsApp/Email). NULL em logs antigos — frontend usa fallback A (reconstrução por template atual).';
COMMENT ON COLUMN public.client_payments.cash_description IS 'Descrição obrigatória quando payment_type=dinheiro (ex: "Recebido no balcão por João, 15/07").';
COMMENT ON COLUMN public.client_payments.parent_payment_id IS 'Vincula o registro complementar ao registro principal em pagamento parcial em dinheiro (2 registros vinculados).';