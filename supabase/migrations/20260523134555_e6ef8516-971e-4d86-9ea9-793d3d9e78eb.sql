CREATE TABLE IF NOT EXISTS public.billing_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('mercadopago','stripe')),
  event_type text,
  external_id text,
  http_status integer,
  result text NOT NULL,
  message text,
  matched_payment_id uuid,
  payload jsonb,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_created_at ON public.billing_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_provider ON public.billing_webhook_logs(provider);

ALTER TABLE public.billing_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/gerentes leem logs de webhook"
  ON public.billing_webhook_logs FOR SELECT
  USING (public.is_admin() OR public.is_gerente());

CREATE POLICY "Service role gerencia logs de webhook"
  ON public.billing_webhook_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');