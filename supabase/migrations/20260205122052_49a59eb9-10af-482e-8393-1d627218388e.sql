-- Fix RLS policies to use 'authenticated' role instead of 'public' where appropriate
-- This ensures only authenticated users can access data, preventing anonymous access

-- =====================
-- PROFILES TABLE FIXES
-- =====================

-- Drop and recreate policies with correct role targeting

-- Admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (is_admin());

-- User policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update safe profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update safe profile fields" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id AND NOT is_admin())
WITH CHECK (auth.uid() = user_id);

-- Keep INSERT policy using service_role for auth trigger
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Service role policy for auth trigger to insert profiles
CREATE POLICY "Service role can insert profiles" 
ON public.profiles 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- =====================
-- CLIENTES TABLE FIXES
-- =====================

-- Admin policies - change from public to authenticated
DROP POLICY IF EXISTS "Admins can view all clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins can delete clientes" ON public.clientes;

CREATE POLICY "Admins can view all clientes" 
ON public.clientes 
FOR SELECT 
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert clientes" 
ON public.clientes 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can update clientes" 
ON public.clientes 
FOR UPDATE 
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can delete clientes" 
ON public.clientes 
FOR DELETE 
TO authenticated
USING (is_admin());

-- Gerentes policies - change from public to authenticated
DROP POLICY IF EXISTS "Gerentes can view their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Gerentes can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Gerentes can update their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Gerentes can delete their own clientes" ON public.clientes;

CREATE POLICY "Gerentes can view their own clientes" 
ON public.clientes 
FOR SELECT 
TO authenticated
USING (is_gerente() AND created_by = auth.uid());

CREATE POLICY "Gerentes can insert clientes" 
ON public.clientes 
FOR INSERT 
TO authenticated
WITH CHECK (is_gerente());

CREATE POLICY "Gerentes can update their own clientes" 
ON public.clientes 
FOR UPDATE 
TO authenticated
USING (is_gerente() AND created_by = auth.uid());

CREATE POLICY "Gerentes can delete their own clientes" 
ON public.clientes 
FOR DELETE 
TO authenticated
USING (is_gerente() AND created_by = auth.uid());

-- Operadores policies - change from public to authenticated
DROP POLICY IF EXISTS "Operadores can view their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Operadores can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Operadores can update their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Operadores can delete their own clientes" ON public.clientes;

CREATE POLICY "Operadores can view their own clientes" 
ON public.clientes 
FOR SELECT 
TO authenticated
USING (is_operador() AND created_by = auth.uid());

CREATE POLICY "Operadores can insert clientes" 
ON public.clientes 
FOR INSERT 
TO authenticated
WITH CHECK (is_operador());

CREATE POLICY "Operadores can update their own clientes" 
ON public.clientes 
FOR UPDATE 
TO authenticated
USING (is_operador() AND created_by = auth.uid());

CREATE POLICY "Operadores can delete their own clientes" 
ON public.clientes 
FOR DELETE 
TO authenticated
USING (is_operador() AND created_by = auth.uid());

-- =====================
-- API_KEYS TABLE FIXES
-- =====================

-- Change from public to authenticated
DROP POLICY IF EXISTS "Admins can manage api_keys" ON public.api_keys;

CREATE POLICY "Admins can manage api_keys" 
ON public.api_keys 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());