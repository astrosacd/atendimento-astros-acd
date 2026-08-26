
-- numeros_aquecimento: restore granular-permission access
DROP POLICY IF EXISTS "Privileged can view numeros_aquecimento" ON public.numeros_aquecimento;
CREATE POLICY "Privileged can view numeros_aquecimento"
ON public.numeros_aquecimento FOR SELECT TO authenticated
USING (is_admin() OR is_gerente() OR is_operador() OR has_permission(auth.uid(), 'view_numeros_aquecimento'));

DROP POLICY IF EXISTS "Privileged can update numeros_aquecimento" ON public.numeros_aquecimento;
CREATE POLICY "Privileged can update numeros_aquecimento"
ON public.numeros_aquecimento FOR UPDATE TO authenticated
USING (is_admin() OR is_gerente() OR is_operador() OR has_permission(auth.uid(), 'edit_numeros_aquecimento') OR has_permission(auth.uid(), 'change_status_numeros'))
WITH CHECK (is_admin() OR is_gerente() OR is_operador() OR has_permission(auth.uid(), 'edit_numeros_aquecimento') OR has_permission(auth.uid(), 'change_status_numeros'));

-- client_history
DROP POLICY IF EXISTS "Operadores can view client history" ON public.client_history;
CREATE POLICY "Operadores can view client history"
ON public.client_history FOR SELECT TO authenticated
USING (is_operador() OR has_permission(auth.uid(), 'view_clientes'));

-- lead_hunter_logs
DROP POLICY IF EXISTS "Privileged can view lead hunter logs" ON public.lead_hunter_logs;
CREATE POLICY "Privileged can view lead hunter logs"
ON public.lead_hunter_logs FOR SELECT TO authenticated
USING (is_admin() OR is_gerente() OR is_operador() OR has_permission(auth.uid(), 'view_lead_hunter'));

-- calendar_notification_logs
DROP POLICY IF EXISTS "Privileged can view calendar notification logs" ON public.calendar_notification_logs;
CREATE POLICY "Privileged can view calendar notification logs"
ON public.calendar_notification_logs FOR SELECT TO authenticated
USING (is_admin() OR is_gerente() OR is_operador() OR has_permission(auth.uid(), 'view_agenda'));
