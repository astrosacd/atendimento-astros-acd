
-- Table for shareable credential links
CREATE TABLE public.social_credential_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.social_credential_share_links ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can manage links
CREATE POLICY "Authenticated users can manage share links"
  ON public.social_credential_share_links
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RPC to fetch credentials by share token (public, no auth needed)
CREATE OR REPLACE FUNCTION public.get_credentials_by_share_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_link RECORD;
  v_credentials jsonb;
  v_client_name text;
BEGIN
  -- Find valid link
  SELECT * INTO v_link
  FROM social_credential_share_links
  WHERE token = p_token AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Link inválido ou expirado');
  END IF;
  
  -- Get client name
  SELECT nome INTO v_client_name
  FROM clientes WHERE id = v_link.cliente_id;
  
  -- Get credentials
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'platform', c.platform,
      'login', c.login,
      'encrypted_password', c.encrypted_password,
      'notes', c.notes
    ) ORDER BY c.platform
  ), '[]'::jsonb)
  INTO v_credentials
  FROM client_social_credentials c
  WHERE c.cliente_id = v_link.cliente_id;
  
  RETURN jsonb_build_object(
    'client_name', v_client_name,
    'credentials', v_credentials,
    'expires_at', v_link.expires_at
  );
END;
$$;
