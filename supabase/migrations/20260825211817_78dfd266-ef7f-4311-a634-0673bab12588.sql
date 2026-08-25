
-- calendar_notification_logs: restrict SELECT to privileged roles
DROP POLICY IF EXISTS "Authenticated users can view calendar notification logs" ON public.calendar_notification_logs;
CREATE POLICY "Privileged can view calendar notification logs"
ON public.calendar_notification_logs FOR SELECT TO authenticated
USING (is_admin() OR is_gerente() OR is_operador());

-- client_history: remove blanket authenticated read
DROP POLICY IF EXISTS "Authenticated users can view client history" ON public.client_history;

-- lead_hunter_logs: replace ALL/true policy with scoped ones
DROP POLICY IF EXISTS "Authenticated users can read logs" ON public.lead_hunter_logs;
CREATE POLICY "Privileged can view lead hunter logs"
ON public.lead_hunter_logs FOR SELECT TO authenticated
USING (is_admin() OR is_gerente() OR is_operador());
CREATE POLICY "Privileged can insert lead hunter logs"
ON public.lead_hunter_logs FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_gerente() OR is_operador());
CREATE POLICY "Admins can manage lead hunter logs"
ON public.lead_hunter_logs FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

-- numeros_aquecimento: scope SELECT to privileged roles
DROP POLICY IF EXISTS "Authenticated can view numeros_aquecimento" ON public.numeros_aquecimento;
CREATE POLICY "Privileged can view numeros_aquecimento"
ON public.numeros_aquecimento FOR SELECT TO authenticated
USING (is_admin() OR is_gerente() OR is_operador());
