-- Drop overly permissive policies on password_reset_tokens
DROP POLICY IF EXISTS "Allow public select for password reset" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Allow public update for password reset" ON public.password_reset_tokens;

-- Create a security definer function to validate tokens without exposing the table
CREATE OR REPLACE FUNCTION public.validate_password_reset_token(p_token text)
RETURNS TABLE(user_id uuid, email text, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prt.user_id,
    prt.email,
    (prt.expires_at > now() AND prt.used = false) as is_valid
  FROM public.password_reset_tokens prt
  WHERE prt.token = p_token
  LIMIT 1;
END;
$$;

-- Create a security definer function to mark token as used
CREATE OR REPLACE FUNCTION public.mark_password_reset_token_used(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.password_reset_tokens
  SET used = true
  WHERE token = p_token
    AND used = false
    AND expires_at > now();
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

-- Only admins can view all tokens (for debugging/admin purposes)
CREATE POLICY "Admins can view password reset tokens" 
ON public.password_reset_tokens 
FOR SELECT 
USING (is_admin());

-- Only allow updating through the security definer function (restrict direct updates)
CREATE POLICY "Admins can update password reset tokens" 
ON public.password_reset_tokens 
FOR UPDATE 
USING (is_admin());