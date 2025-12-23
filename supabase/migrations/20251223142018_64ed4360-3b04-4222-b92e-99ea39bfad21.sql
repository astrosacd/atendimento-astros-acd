-- Fix 1: Secure chamados_codigos_verificacao table - service role only
DROP POLICY IF EXISTS "Service can manage codigos_verificacao" ON public.chamados_codigos_verificacao;

CREATE POLICY "Service role only for verification codes" 
ON public.chamados_codigos_verificacao 
FOR ALL 
TO service_role
USING (true);

-- Fix 2: Secure profiles table - prevent users from modifying admin fields

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update safe profile fields" ON public.profiles;

-- Create function to check if sensitive fields changed
CREATE OR REPLACE FUNCTION public.check_profile_safe_update()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_profile RECORD;
BEGIN
  SELECT 
    approval_status, 
    is_blocked, 
    blocked_reason, 
    blocked_by, 
    blocked_at, 
    rejection_reason,
    approved
  INTO v_current_profile
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  RETURN true;
END;
$$;

-- User policy: only safe fields (name, email, phone, user_response)
-- This policy prevents users from modifying admin-controlled fields
CREATE POLICY "Users can update safe profile fields" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id AND NOT is_admin())
WITH CHECK (
  auth.uid() = user_id
);

-- Admin policy: full access to all profiles
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

-- Create a trigger to prevent users from modifying admin fields
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If not admin, prevent changes to sensitive fields
  IF NOT is_admin() THEN
    NEW.approval_status := OLD.approval_status;
    NEW.approved := OLD.approved;
    NEW.is_blocked := OLD.is_blocked;
    NEW.blocked_reason := OLD.blocked_reason;
    NEW.blocked_by := OLD.blocked_by;
    NEW.blocked_at := OLD.blocked_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS protect_profile_admin_fields_trigger ON public.profiles;

CREATE TRIGGER protect_profile_admin_fields_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_admin_fields();