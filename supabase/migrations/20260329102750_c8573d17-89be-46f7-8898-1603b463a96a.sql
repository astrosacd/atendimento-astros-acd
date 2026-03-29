
CREATE TABLE public.sms_validation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  resultado text NOT NULL,
  motivo text,
  baserow_row_id text,
  user_id uuid NOT NULL,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_validation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sms_validation_logs"
  ON public.sms_validation_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert sms_validation_logs"
  ON public.sms_validation_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
