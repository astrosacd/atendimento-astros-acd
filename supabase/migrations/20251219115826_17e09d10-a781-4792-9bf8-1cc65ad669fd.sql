-- =====================================================
-- SECURITY FIX: Remove public access to profiles table
-- =====================================================

-- 1. Drop the vulnerable public policy that exposes all user data
DROP POLICY IF EXISTS "Allow email lookup for password recovery" ON public.profiles;

-- 2. Drop the redundant public update policy
DROP POLICY IF EXISTS "Allow update via email for rejected users" ON public.profiles;

-- 3. Create a secure function to verify email exists (for password recovery)
-- This returns only a boolean, never exposing actual data
CREATE OR REPLACE FUNCTION public.verify_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return boolean, never expose actual data
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email)
  );
END;
$$;

-- 4. Create a secure function to get user_id by email (for password recovery edge functions)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

-- =====================================================
-- SECURITY FIX: Strengthen clientes table RLS
-- =====================================================

-- 5. Drop the weak "Block anonymous access" policy that allows any authenticated user
DROP POLICY IF EXISTS "Block anonymous access to clientes" ON public.clientes;

-- Note: The existing role-based policies (Admins, Gerentes, Operadores) already 
-- provide proper access control. The removed policy was redundant and misleading
-- as it only checked for authentication without proper role verification.