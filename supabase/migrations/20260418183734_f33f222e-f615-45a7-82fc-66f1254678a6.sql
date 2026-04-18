ALTER TABLE public.payment_link_share_tokens 
ADD COLUMN allow_status_check boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_payment_link_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token RECORD;
BEGIN
  SELECT token, expires_at, allowed_providers, allow_status_check, created_at, created_by_email
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
    'allow_status_check', v_token.allow_status_check,
    'created_at', v_token.created_at,
    'created_by_email', v_token.created_by_email
  );
END;
$function$;