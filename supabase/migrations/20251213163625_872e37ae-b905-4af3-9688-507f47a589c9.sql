-- Add explicit policy to block anonymous access on clientes table
-- This is an extra layer of security even though existing policies already require auth
CREATE POLICY "Block anonymous access to clientes"
ON public.clientes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add explicit policy to block anonymous access on profiles table
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add explicit policy to block all non-admin access on audit_logs
CREATE POLICY "Block non-admin access to audit logs"
ON public.audit_logs
FOR SELECT
USING (is_admin());