-- Create payment link history table
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'stripe')),
  provider_label TEXT NOT NULL,
  config_source TEXT NOT NULL,
  valor_original NUMERIC(12,2) NOT NULL,
  valor_com_taxa NUMERIC(12,2) NOT NULL,
  taxa_percentual NUMERIC(8,2) NOT NULL DEFAULT 0,
  payment_url TEXT NOT NULL,
  preference_id TEXT,
  external_reference TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payment links"
ON public.payment_links
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can insert payment links"
ON public.payment_links
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_payment_links_created_at ON public.payment_links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_links_provider ON public.payment_links(provider);

-- Create temporary access tokens table
CREATE TABLE IF NOT EXISTS public.payment_link_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  allowed_providers TEXT[] NOT NULL DEFAULT ARRAY['mercadopago','stripe'],
  created_by UUID,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_link_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view share tokens"
ON public.payment_link_share_tokens
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create share tokens"
ON public.payment_link_share_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete share tokens"
ON public.payment_link_share_tokens
FOR DELETE
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_payment_link_share_tokens_expires_at ON public.payment_link_share_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_link_share_tokens_token ON public.payment_link_share_tokens(token);

-- Public validation RPC for temporary access
CREATE OR REPLACE FUNCTION public.validate_payment_link_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token RECORD;
BEGIN
  SELECT token, expires_at, allowed_providers, created_at, created_by_email
  INTO v_token
  FROM public.payment_link_share_tokens
  WHERE token = p_token
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'expires_at', v_token.expires_at,
    'allowed_providers', v_token.allowed_providers,
    'created_at', v_token.created_at,
    'created_by_email', v_token.created_by_email
  );
END;
$$;