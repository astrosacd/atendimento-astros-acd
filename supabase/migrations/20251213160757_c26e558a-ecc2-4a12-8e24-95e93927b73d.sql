-- Drop the overly permissive policy that allows any authenticated user to view all clients
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;

-- Create proper SELECT policy for Admins (can view all)
CREATE POLICY "Admins can view all clientes" 
ON public.clientes 
FOR SELECT 
USING (is_admin());

-- Create SELECT policy for Operadores (can view all for their work)
CREATE POLICY "Operadores can view all clientes" 
ON public.clientes 
FOR SELECT 
USING (is_operador());

-- Note: Gerentes already have a policy to view their own clientes:
-- "Gerentes can view their own clientes" - is_gerente() AND created_by = auth.uid()