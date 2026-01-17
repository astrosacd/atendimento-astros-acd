-- Fix permissive UPDATE policy on consulta_numeros_auto_sync_config
-- Restrict UPDATE to admin-only for consistency with other config tables

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can update auto sync config" 
  ON public.consulta_numeros_auto_sync_config;

-- Create admin-only UPDATE policy
CREATE POLICY "Admins can update auto sync config" 
  ON public.consulta_numeros_auto_sync_config 
  FOR UPDATE 
  TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());