
-- Helper predicate reused: is_admin() OR is_gerente()

-- ============ despesas ============
DROP POLICY IF EXISTS "Usuarios autenticados podem ver despesas" ON public.despesas;
DROP POLICY IF EXISTS "Usuarios autenticados podem criar despesas" ON public.despesas;
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar despesas" ON public.despesas;
DROP POLICY IF EXISTS "Usuarios autenticados podem deletar despesas" ON public.despesas;
CREATE POLICY "Admin/gerente veem despesas" ON public.despesas FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente criam despesas" ON public.despesas FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente atualizam despesas" ON public.despesas FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente deletam despesas" ON public.despesas FOR DELETE TO authenticated USING (public.is_admin() OR public.is_gerente());

-- ============ despesa_categorias ============
DROP POLICY IF EXISTS "Usuarios autenticados podem ver categorias" ON public.despesa_categorias;
DROP POLICY IF EXISTS "Usuarios autenticados podem criar categorias" ON public.despesa_categorias;
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar categorias" ON public.despesa_categorias;
DROP POLICY IF EXISTS "Usuarios autenticados podem deletar categorias" ON public.despesa_categorias;
CREATE POLICY "Autenticados veem categorias" ON public.despesa_categorias FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin/gerente gerenciam categorias" ON public.despesa_categorias FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente atualizam categorias" ON public.despesa_categorias FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente deletam categorias" ON public.despesa_categorias FOR DELETE TO authenticated USING (public.is_admin() OR public.is_gerente());

-- ============ marketing_expenses ============
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.marketing_expenses;
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.marketing_expenses;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON public.marketing_expenses;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON public.marketing_expenses;
CREATE POLICY "Admin/gerente veem marketing_expenses" ON public.marketing_expenses FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente criam marketing_expenses" ON public.marketing_expenses FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente atualizam marketing_expenses" ON public.marketing_expenses FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente deletam marketing_expenses" ON public.marketing_expenses FOR DELETE TO authenticated USING (public.is_admin() OR public.is_gerente());

-- ============ sales_forecasts ============
DROP POLICY IF EXISTS "Authenticated users can view sales forecasts" ON public.sales_forecasts;
DROP POLICY IF EXISTS "Authenticated users can create sales forecasts" ON public.sales_forecasts;
CREATE POLICY "Admin/gerente veem sales_forecasts" ON public.sales_forecasts FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente criam sales_forecasts" ON public.sales_forecasts FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_gerente()) AND auth.uid() = generated_by);

-- ============ lead_hunter ============
DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.lead_hunter_leads;
DROP POLICY IF EXISTS "Authenticated users can manage campanhas" ON public.lead_hunter_campanhas;
DROP POLICY IF EXISTS "Authenticated users can manage buscas" ON public.lead_hunter_buscas;
CREATE POLICY "Admin/gerente gerenciam leads" ON public.lead_hunter_leads FOR ALL TO authenticated USING (public.is_admin() OR public.is_gerente()) WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente gerenciam campanhas" ON public.lead_hunter_campanhas FOR ALL TO authenticated USING (public.is_admin() OR public.is_gerente()) WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente gerenciam buscas" ON public.lead_hunter_buscas FOR ALL TO authenticated USING (public.is_admin() OR public.is_gerente()) WITH CHECK (public.is_admin() OR public.is_gerente());

-- ============ numeros_aquecimento_aparelhos ============
DROP POLICY IF EXISTS "Authenticated users can view aparelhos" ON public.numeros_aquecimento_aparelhos;
DROP POLICY IF EXISTS "Authenticated users can create aparelhos" ON public.numeros_aquecimento_aparelhos;
DROP POLICY IF EXISTS "Authenticated users can update aparelhos" ON public.numeros_aquecimento_aparelhos;
DROP POLICY IF EXISTS "Authenticated users can delete aparelhos" ON public.numeros_aquecimento_aparelhos;
CREATE POLICY "Autenticados veem aparelhos" ON public.numeros_aquecimento_aparelhos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin/gerente criam aparelhos" ON public.numeros_aquecimento_aparelhos FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente atualizam aparelhos" ON public.numeros_aquecimento_aparelhos FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente deletam aparelhos" ON public.numeros_aquecimento_aparelhos FOR DELETE TO authenticated USING (public.is_admin() OR public.is_gerente());

-- ============ consulta_numeros_cache ============
DROP POLICY IF EXISTS "Authenticated users can read consulta_numeros_cache" ON public.consulta_numeros_cache;
CREATE POLICY "Usuarios com permissao veem consulta_numeros_cache" ON public.consulta_numeros_cache FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission(auth.uid(), 'view_consulta_numeros'));

-- ============ bloqueios_historico ============
DROP POLICY IF EXISTS "Autenticados leem historico" ON public.bloqueios_historico;
DROP POLICY IF EXISTS "Autenticados inserem historico" ON public.bloqueios_historico;
CREATE POLICY "Admin leem historico" ON public.bloqueios_historico FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Autenticados inserem historico" ON public.bloqueios_historico FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ============ whatsapp_group_default_participants ============
DROP POLICY IF EXISTS "Authenticated users can view default participants" ON public.whatsapp_group_default_participants;
DROP POLICY IF EXISTS "Authenticated users can manage default participants" ON public.whatsapp_group_default_participants;
DROP POLICY IF EXISTS "Authenticated users can update default participants" ON public.whatsapp_group_default_participants;
DROP POLICY IF EXISTS "Authenticated users can delete default participants" ON public.whatsapp_group_default_participants;
CREATE POLICY "Admin/gerente veem default participants" ON public.whatsapp_group_default_participants FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente criam default participants" ON public.whatsapp_group_default_participants FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente atualizam default participants" ON public.whatsapp_group_default_participants FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente deletam default participants" ON public.whatsapp_group_default_participants FOR DELETE TO authenticated USING (public.is_admin() OR public.is_gerente());

-- ============ qr_scan_insurance_usage ============
DROP POLICY IF EXISTS "Users can view all insurance usage" ON public.qr_scan_insurance_usage;
DROP POLICY IF EXISTS "Users can insert insurance usage" ON public.qr_scan_insurance_usage;
CREATE POLICY "Admin/gerente veem insurance usage" ON public.qr_scan_insurance_usage FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente inserem insurance usage" ON public.qr_scan_insurance_usage FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente());

-- ============ qr_scan_insurance_payment_status ============
DROP POLICY IF EXISTS "Authenticated users can view insurance payment status" ON public.qr_scan_insurance_payment_status;
DROP POLICY IF EXISTS "Authenticated users can insert insurance payment status" ON public.qr_scan_insurance_payment_status;
DROP POLICY IF EXISTS "Authenticated users can update insurance payment status" ON public.qr_scan_insurance_payment_status;
DROP POLICY IF EXISTS "Authenticated users can delete insurance payment status" ON public.qr_scan_insurance_payment_status;
CREATE POLICY "Admin/gerente veem insurance payment status" ON public.qr_scan_insurance_payment_status FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente inserem insurance payment status" ON public.qr_scan_insurance_payment_status FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente atualizam insurance payment status" ON public.qr_scan_insurance_payment_status FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_gerente());
CREATE POLICY "Admin/gerente deletam insurance payment status" ON public.qr_scan_insurance_payment_status FOR DELETE TO authenticated USING (public.is_admin() OR public.is_gerente());

-- ============ qr_scan_checkins_diarios ============
DROP POLICY IF EXISTS "Usuarios autenticados leem checkins" ON public.qr_scan_checkins_diarios;
CREATE POLICY "Admin/gerente leem checkins" ON public.qr_scan_checkins_diarios FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente() OR public.has_permission(auth.uid(), 'view_consulta_numeros'));

-- ============ qr_scan_history ============
DROP POLICY IF EXISTS "qr_scan_history_select_auth" ON public.qr_scan_history;
DROP POLICY IF EXISTS "qr_scan_history_insert_auth" ON public.qr_scan_history;
DROP POLICY IF EXISTS "qr_scan_history_update_auth" ON public.qr_scan_history;
CREATE POLICY "qr_scan_history_select_priv" ON public.qr_scan_history FOR SELECT TO authenticated USING (public.is_admin() OR public.is_gerente() OR public.has_permission(auth.uid(), 'view_consulta_numeros'));
CREATE POLICY "qr_scan_history_insert_priv" ON public.qr_scan_history FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.is_gerente() OR public.has_permission(auth.uid(), 'view_consulta_numeros'));
CREATE POLICY "qr_scan_history_update_priv" ON public.qr_scan_history FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_gerente() OR public.has_permission(auth.uid(), 'view_consulta_numeros')) WITH CHECK (public.is_admin() OR public.is_gerente() OR public.has_permission(auth.uid(), 'view_consulta_numeros'));
