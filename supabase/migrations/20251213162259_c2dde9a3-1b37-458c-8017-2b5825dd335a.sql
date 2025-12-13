-- Fix system_permissions: require authentication instead of public access
DROP POLICY IF EXISTS "Anyone can view system_permissions" ON public.system_permissions;
CREATE POLICY "Authenticated users can view system_permissions" 
ON public.system_permissions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix role_permissions: require authentication instead of public access
DROP POLICY IF EXISTS "Anyone can view role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can view role_permissions" 
ON public.role_permissions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix custom_roles: require authentication instead of public access
DROP POLICY IF EXISTS "Anyone can view custom_roles" ON public.custom_roles;
CREATE POLICY "Authenticated users can view custom_roles" 
ON public.custom_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix audit_logs insert policy: use security definer function for service operations
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

-- Create a security definer function for audit log insertion
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_api_key_id uuid DEFAULT NULL,
  p_webhook_id uuid DEFAULT NULL,
  p_request_method text DEFAULT NULL,
  p_request_path text DEFAULT NULL,
  p_request_body jsonb DEFAULT NULL,
  p_response_status integer DEFAULT NULL,
  p_response_body jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    action, resource_type, resource_id, api_key_id, webhook_id,
    request_method, request_path, request_body, response_status,
    response_body, ip_address, user_agent
  ) VALUES (
    p_action, p_resource_type, p_resource_id, p_api_key_id, p_webhook_id,
    p_request_method, p_request_path, p_request_body, p_response_status,
    p_response_body, p_ip_address, p_user_agent
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create rate-limited password reset token insertion function
CREATE OR REPLACE FUNCTION public.create_password_reset_token(
  p_user_id uuid,
  p_email text,
  p_token text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count integer;
BEGIN
  -- Rate limiting: max 3 requests per hour per email
  SELECT COUNT(*) INTO v_recent_count
  FROM public.password_reset_tokens
  WHERE email = p_email
    AND created_at > now() - interval '1 hour';
  
  IF v_recent_count >= 3 THEN
    RETURN false;
  END IF;
  
  INSERT INTO public.password_reset_tokens (user_id, email, token, expires_at)
  VALUES (p_user_id, p_email, p_token, p_expires_at);
  
  RETURN true;
END;
$$;

-- Remove direct public insert on password_reset_tokens
DROP POLICY IF EXISTS "Allow public insert for password reset" ON public.password_reset_tokens;