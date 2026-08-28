-- clientes
DROP POLICY "Admins can view all clientes" ON public.clientes;
CREATE POLICY "Admins can view all clientes" ON public.clientes FOR SELECT TO authenticated USING ((select public.is_admin()));

DROP POLICY "Admins can update clientes" ON public.clientes;
CREATE POLICY "Admins can update clientes" ON public.clientes FOR UPDATE TO authenticated USING ((select public.is_admin()));

DROP POLICY "Admins can delete clientes" ON public.clientes;
CREATE POLICY "Admins can delete clientes" ON public.clientes FOR DELETE TO authenticated USING ((select public.is_admin()));

DROP POLICY "Admins can insert clientes" ON public.clientes;
CREATE POLICY "Admins can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));

DROP POLICY "Gerentes can view their own clientes" ON public.clientes;
CREATE POLICY "Gerentes can view their own clientes" ON public.clientes FOR SELECT TO authenticated USING ((select public.is_gerente()) AND created_by = (select auth.uid()));

DROP POLICY "Gerentes can update their own clientes" ON public.clientes;
CREATE POLICY "Gerentes can update their own clientes" ON public.clientes FOR UPDATE TO authenticated USING ((select public.is_gerente()) AND created_by = (select auth.uid()));

DROP POLICY "Gerentes can delete their own clientes" ON public.clientes;
CREATE POLICY "Gerentes can delete their own clientes" ON public.clientes FOR DELETE TO authenticated USING ((select public.is_gerente()) AND created_by = (select auth.uid()));

DROP POLICY "Gerentes can insert clientes" ON public.clientes;
CREATE POLICY "Gerentes can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK ((select public.is_gerente()));

DROP POLICY "Operadores can view all clientes" ON public.clientes;
CREATE POLICY "Operadores can view all clientes" ON public.clientes FOR SELECT USING ((select public.is_operador()));

DROP POLICY "Operadores can update all clientes" ON public.clientes;
CREATE POLICY "Operadores can update all clientes" ON public.clientes FOR UPDATE USING ((select public.is_operador()));

DROP POLICY "Operadores can delete all clientes" ON public.clientes;
CREATE POLICY "Operadores can delete all clientes" ON public.clientes FOR DELETE USING ((select public.is_operador()));

DROP POLICY "Operadores can insert clientes" ON public.clientes;
CREATE POLICY "Operadores can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK ((select public.is_operador()));

DROP POLICY "Temp access can view clientes" ON public.clientes;
CREATE POLICY "Temp access can view clientes" ON public.clientes FOR SELECT TO anon, authenticated
USING ((select public.has_ligacoes_temp_perm('campanhas')) OR (select public.has_ligacoes_temp_perm('disparo')) OR (select public.has_ligacoes_temp_perm('fila')));

-- consulta_numeros_cache
DROP POLICY "Usuarios com permissao veem consulta_numeros_cache" ON public.consulta_numeros_cache;
CREATE POLICY "Usuarios com permissao veem consulta_numeros_cache" ON public.consulta_numeros_cache FOR SELECT TO authenticated
USING ((select public.is_admin()) OR (select public.has_permission((select auth.uid()), 'view_consulta_numeros')));

-- qr_scan_checkins_diarios
DROP POLICY "Admin/gerente leem checkins" ON public.qr_scan_checkins_diarios;
CREATE POLICY "Admin/gerente leem checkins" ON public.qr_scan_checkins_diarios FOR SELECT TO authenticated
USING ((select public.is_admin()) OR (select public.is_gerente()) OR (select public.has_permission((select auth.uid()), 'view_consulta_numeros')));

DROP POLICY "Admins gerenciam checkins" ON public.qr_scan_checkins_diarios;
CREATE POLICY "Admins gerenciam checkins" ON public.qr_scan_checkins_diarios FOR ALL TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

-- consulta_numeros_reminder_logs
DROP POLICY "Admins can view reminder logs" ON public.consulta_numeros_reminder_logs;
CREATE POLICY "Admins can view reminder logs" ON public.consulta_numeros_reminder_logs FOR SELECT TO authenticated USING ((select public.is_admin()));

DROP POLICY "Admins can insert reminder logs" ON public.consulta_numeros_reminder_logs;
CREATE POLICY "Admins can insert reminder logs" ON public.consulta_numeros_reminder_logs FOR INSERT TO authenticated WITH CHECK ((select public.is_admin()));

-- índices para os predicados quentes
CREATE INDEX IF NOT EXISTS idx_cnrl_channel_status_sent_at ON public.consulta_numeros_reminder_logs (channel, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_checkins_data_created ON public.qr_scan_checkins_diarios (data_checkin DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON public.clientes (created_at DESC);