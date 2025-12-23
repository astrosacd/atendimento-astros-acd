-- Fix: Restrict operadores to only view clients they created (data minimization)
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Operadores can view all clientes" ON public.clientes;

-- Create restricted policy: operadores can only view clients they created
CREATE POLICY "Operadores can view their own clientes" 
ON public.clientes 
FOR SELECT 
USING (is_operador() AND created_by = auth.uid());

-- Also fix the update policy for operadores to only update their own clients
DROP POLICY IF EXISTS "Operadores can update clientes" ON public.clientes;

CREATE POLICY "Operadores can update their own clientes" 
ON public.clientes 
FOR UPDATE 
USING (is_operador() AND created_by = auth.uid());

-- Add delete policy for operadores to only delete their own clients
CREATE POLICY "Operadores can delete their own clientes" 
ON public.clientes 
FOR DELETE 
USING (is_operador() AND created_by = auth.uid());