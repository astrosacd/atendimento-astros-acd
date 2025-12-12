-- Create function to check if user is operador
CREATE OR REPLACE FUNCTION public.is_operador()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'operador')
$$;

-- Create function to check if user is gerente
CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'gerente')
$$;

-- RLS policies for Operador (can insert and update, but not delete)
CREATE POLICY "Operadores can insert clientes"
ON public.clientes
FOR INSERT
WITH CHECK (is_operador());

CREATE POLICY "Operadores can update clientes"
ON public.clientes
FOR UPDATE
USING (is_operador());

-- RLS policies for Gerente (can only manage clients they created)
CREATE POLICY "Gerentes can insert clientes"
ON public.clientes
FOR INSERT
WITH CHECK (is_gerente());

CREATE POLICY "Gerentes can view their own clientes"
ON public.clientes
FOR SELECT
USING (is_gerente() AND created_by = auth.uid());

CREATE POLICY "Gerentes can update their own clientes"
ON public.clientes
FOR UPDATE
USING (is_gerente() AND created_by = auth.uid());

CREATE POLICY "Gerentes can delete their own clientes"
ON public.clientes
FOR DELETE
USING (is_gerente() AND created_by = auth.uid());

-- Allow operadores and gerentes to insert client history
CREATE POLICY "Operadores can insert client history"
ON public.client_history
FOR INSERT
WITH CHECK (is_operador());

CREATE POLICY "Gerentes can insert client history"
ON public.client_history
FOR INSERT
WITH CHECK (is_gerente());