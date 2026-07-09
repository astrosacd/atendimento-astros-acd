
-- client_history: restrict INSERT to privileged roles only (admin/gerente/operador + service_role)
DROP POLICY IF EXISTS "Authenticated users can insert history" ON public.client_history;

-- consulta_numeros_tipo: restrict INSERT to admins
DROP POLICY IF EXISTS "Usuarios autenticados podem inserir tipos" ON public.consulta_numeros_tipo;
CREATE POLICY "Admins podem inserir tipos" ON public.consulta_numeros_tipo
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins podem atualizar tipos" ON public.consulta_numeros_tipo
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins podem deletar tipos" ON public.consulta_numeros_tipo
  FOR DELETE TO authenticated USING (public.is_admin());

-- numeros_aquecimento: restrict INSERT/UPDATE to admin/gerente/operador
DROP POLICY IF EXISTS "Authenticated can insert numeros_aquecimento" ON public.numeros_aquecimento;
DROP POLICY IF EXISTS "Authenticated can update numeros_aquecimento" ON public.numeros_aquecimento;
CREATE POLICY "Privileged can insert numeros_aquecimento" ON public.numeros_aquecimento
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente() OR public.is_operador());
CREATE POLICY "Privileged can update numeros_aquecimento" ON public.numeros_aquecimento
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente() OR public.is_operador())
  WITH CHECK (public.is_admin() OR public.is_gerente() OR public.is_operador());

-- shared_access_tokens: restrict INSERT/DELETE to admins
DROP POLICY IF EXISTS "Authenticated users can create tokens" ON public.shared_access_tokens;
DROP POLICY IF EXISTS "Authenticated users can delete tokens" ON public.shared_access_tokens;
CREATE POLICY "Admins can create shared_access_tokens" ON public.shared_access_tokens
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete shared_access_tokens" ON public.shared_access_tokens
  FOR DELETE TO authenticated USING (public.is_admin());

-- gateway_orders: explicitly reaffirm anon block (already exists) — no-op but ensures clarity.
-- No change needed; policy block_anon_gateway_orders already denies anon.
