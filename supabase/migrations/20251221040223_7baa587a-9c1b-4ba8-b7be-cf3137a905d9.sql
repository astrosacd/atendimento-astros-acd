-- Expose ONLY the auth access code to unauthenticated clients without opening gateway_settings

CREATE OR REPLACE FUNCTION public.get_auth_access_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT (value->>'code')
      FROM public.gateway_settings
      WHERE key = 'auth_access_code'
      LIMIT 1
    ),
    'astros2024'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_access_code() TO anon;
GRANT EXECUTE ON FUNCTION public.get_auth_access_code() TO authenticated;