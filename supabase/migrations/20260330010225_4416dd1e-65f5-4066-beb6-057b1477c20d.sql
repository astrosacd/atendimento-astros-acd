
-- Add SMS validation share tokens table
CREATE TABLE public.sms_validation_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_by_email text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_validation_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage share tokens"
  ON public.sms_validation_share_tokens
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RPC to validate SMS share token (public access)
CREATE OR REPLACE FUNCTION public.validate_sms_share_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token RECORD;
BEGIN
  SELECT token, expires_at, created_by_email, created_at
  INTO v_token
  FROM public.sms_validation_share_tokens
  WHERE token = p_token
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'expires_at', v_token.expires_at,
    'created_by_email', v_token.created_by_email,
    'created_at', v_token.created_at
  );
END;
$$;

-- Add permission for Validação SMS
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
  ('view_validacao_sms', 'Ver Validação SMS', 'Permite acessar a aba de Validação & SMS no módulo Consulta de Números', 'Consulta de Números'),
  ('share_validacao_sms', 'Compartilhar Validação SMS', 'Permite gerar links de acesso temporário para a Validação SMS', 'Consulta de Números')
ON CONFLICT (key) DO NOTHING;
