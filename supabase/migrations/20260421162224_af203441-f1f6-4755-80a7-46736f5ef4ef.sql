ALTER TABLE public.client_payments
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by_email text,
  ADD COLUMN IF NOT EXISTS approval_reason text,
  ADD COLUMN IF NOT EXISTS approval_override boolean DEFAULT false;

COMMENT ON COLUMN public.client_payments.approval_reason IS
  'Justificativa quando o aprovador libera um pagamento marcado como duplicado ou com valor divergente pela IA.';
COMMENT ON COLUMN public.client_payments.approval_override IS
  'TRUE quando o aprovador autorizou o pagamento mesmo com alerta de fraude (duplicado/divergente).';