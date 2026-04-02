CREATE OR REPLACE FUNCTION public.get_credentials_by_share_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link RECORD;
  v_credentials jsonb;
  v_logos jsonb;
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
  
  -- Get logos
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'file_name', l.file_name,
      'file_path', l.file_path,
      'file_type', l.file_type,
      'file_size', l.file_size,
      'description', l.description
    ) ORDER BY l.created_at DESC
  ), '[]'::jsonb)
  INTO v_logos
  FROM client_logos l
  WHERE l.cliente_id = v_link.cliente_id;
  
  RETURN jsonb_build_object(
    'client_name', v_client_name,
    'credentials', v_credentials,
    'logos', v_logos,
    'expires_at', v_link.expires_at
  );
END;
$function$;