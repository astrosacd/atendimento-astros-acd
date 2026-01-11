-- Fix permissive RLS policies on configuration tables
-- Issue: numeros_aquecimento_alert_config and client_recovery_attempts allow any authenticated user to modify

-- =====================================================
-- Fix 1: numeros_aquecimento_alert_config - restrict to admin only
-- =====================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert alert config" ON public.numeros_aquecimento_alert_config;
DROP POLICY IF EXISTS "Authenticated users can update alert config" ON public.numeros_aquecimento_alert_config;

-- Create admin-only policies using is_admin() function
CREATE POLICY "Admins can insert alert config" 
ON public.numeros_aquecimento_alert_config 
FOR INSERT 
TO authenticated 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update alert config" 
ON public.numeros_aquecimento_alert_config 
FOR UPDATE 
TO authenticated 
USING (is_admin()) 
WITH CHECK (is_admin());

-- =====================================================
-- Fix 2: client_recovery_attempts - restrict updates to admin only
-- =====================================================

-- Drop the overly permissive policies  
DROP POLICY IF EXISTS "Authenticated users can insert recovery attempts" ON public.client_recovery_attempts;
DROP POLICY IF EXISTS "Authenticated users can update recovery attempts" ON public.client_recovery_attempts;

-- Keep INSERT permissive (needed for edge functions to log attempts)
-- but restrict UPDATE to admin only
CREATE POLICY "Authenticated users can insert recovery attempts" 
ON public.client_recovery_attempts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Admins can update recovery attempts" 
ON public.client_recovery_attempts 
FOR UPDATE 
TO authenticated 
USING (is_admin()) 
WITH CHECK (is_admin());