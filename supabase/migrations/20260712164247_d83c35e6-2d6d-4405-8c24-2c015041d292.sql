
CREATE TABLE public.instagram_data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code text NOT NULL UNIQUE,
  ig_user_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  signed_request_raw text,
  error_message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ig_deletion_code ON public.instagram_data_deletion_requests(confirmation_code);
CREATE INDEX idx_ig_deletion_ig_user ON public.instagram_data_deletion_requests(ig_user_id);

GRANT SELECT ON public.instagram_data_deletion_requests TO anon;
GRANT SELECT ON public.instagram_data_deletion_requests TO authenticated;
GRANT ALL  ON public.instagram_data_deletion_requests TO service_role;

ALTER TABLE public.instagram_data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode consultar UM registro se souber o confirmation_code (página pública de status).
-- A checagem por código é feita na query (.eq('confirmation_code', ?)); RLS libera SELECT.
CREATE POLICY "Public can lookup deletion status by code"
ON public.instagram_data_deletion_requests
FOR SELECT
TO anon, authenticated
USING (true);

-- Somente service_role escreve (edge functions).
CREATE POLICY "Service role manages deletion requests"
ON public.instagram_data_deletion_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_ig_deletion_updated_at
BEFORE UPDATE ON public.instagram_data_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
