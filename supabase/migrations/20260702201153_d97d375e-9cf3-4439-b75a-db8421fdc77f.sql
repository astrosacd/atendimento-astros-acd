
-- 1) temporary_access_tokens: remove public SELECT; add SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Public can view valid tokens" ON public.temporary_access_tokens;

CREATE OR REPLACE FUNCTION public.validate_temporary_access_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.temporary_access_tokens%ROWTYPE;
  v_already_counted boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid');
  END IF;

  SELECT * INTO v_row
  FROM public.temporary_access_tokens
  WHERE token = p_token
    AND is_active = true
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired_or_invalid');
  END IF;

  IF v_row.max_uses IS NOT NULL AND v_row.uses >= v_row.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'max_uses_reached');
  END IF;

  v_already_counted := COALESCE((current_setting('request.headers', true)::json->>'x-temp-access-counted') = '1', false);
  IF NOT v_already_counted THEN
    UPDATE public.temporary_access_tokens
    SET uses = uses + 1
    WHERE id = v_row.id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'target_path', v_row.target_path,
    'permissions', to_jsonb(v_row.permissions),
    'expires_at', v_row.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_temporary_access_token(text) TO anon, authenticated;

-- 2) realtime.messages: tighten default (non-divulgador) topics to admin-only for broadcast/presence
DROP POLICY IF EXISTS "Realtime broadcast scoped by topic" ON realtime.messages;
DROP POLICY IF EXISTS "Realtime read scoped by topic" ON realtime.messages;

CREATE POLICY "Realtime broadcast scoped by topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN (realtime.topic() ~~* '%divulgador%') THEN (public.is_admin() OR public.has_permission(auth.uid(), 'view_divulgador'))
    ELSE public.is_admin()
  END
);

CREATE POLICY "Realtime read scoped by topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN (realtime.topic() ~~* '%divulgador%') THEN (public.is_admin() OR public.has_permission(auth.uid(), 'view_divulgador'))
    ELSE public.is_admin()
  END
);
