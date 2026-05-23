
-- 1. RESTRICTIVE anon-block on sensitive admin-only tables
CREATE POLICY "Block anon access" ON public.atomicat_settings AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.billing_stripe_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.password_reset_tokens AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.consulta_numeros_reminder_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.social_media_report_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.proposal_send_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.pipeline_ai_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.reports_analysis_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.meta_credentials AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Block anon access" ON public.client_social_credentials AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- 2. client_social_credentials: restrict to admin/gerente
DROP POLICY IF EXISTS "Authenticated users can view social credentials" ON public.client_social_credentials;
DROP POLICY IF EXISTS "Authenticated users can insert social credentials" ON public.client_social_credentials;
DROP POLICY IF EXISTS "Authenticated users can update social credentials" ON public.client_social_credentials;
DROP POLICY IF EXISTS "Authenticated users can delete social credentials" ON public.client_social_credentials;
CREATE POLICY "Admins and gerentes manage social credentials"
  ON public.client_social_credentials FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());

-- 3. meta_credentials: admin only
DROP POLICY IF EXISTS "Allow all authenticated users on meta_credentials" ON public.meta_credentials;
CREATE POLICY "Admins manage meta credentials"
  ON public.meta_credentials FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. reports_analysis_config: admin only
DROP POLICY IF EXISTS "Authenticated users can manage reports config" ON public.reports_analysis_config;
DROP POLICY IF EXISTS "Authenticated users can view reports config" ON public.reports_analysis_config;
CREATE POLICY "Admins manage reports analysis config"
  ON public.reports_analysis_config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. instagram_settings: remove temp token public read
DROP POLICY IF EXISTS "Public guest can view settings via token" ON public.instagram_settings;

-- 6. social_media_client_profiles / monthly_reports: remove anon select (public access via RPC)
DROP POLICY IF EXISTS "Public read profile via report" ON public.social_media_client_profiles;
DROP POLICY IF EXISTS "Public read by share_token" ON public.social_media_monthly_reports;

-- 7. system_settings: hide recaptcha_secret_key from public
DROP POLICY IF EXISTS "Anyone can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Only auth can insert settings" ON public.system_settings;
DROP POLICY IF EXISTS "Only auth can update settings" ON public.system_settings;
CREATE POLICY "Public read non-secret settings"
  ON public.system_settings FOR SELECT TO anon, authenticated
  USING (key <> 'recaptcha_secret_key');
CREATE POLICY "Admins manage settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8. clientes: prevent anon (temp-token) from reading CPF column
REVOKE SELECT (cpf) ON public.clientes FROM anon;

-- 9. gateway_orders: scope manager update to authenticated
DROP POLICY IF EXISTS "Managers and Finance can update orders for approval" ON public.gateway_orders;
CREATE POLICY "Managers and Finance can update orders for approval"
  ON public.gateway_orders FOR UPDATE TO authenticated
  USING (public.can_approve_order(auth.uid()))
  WITH CHECK (public.can_approve_order(auth.uid()));

-- 10. Storage: receipts and payment-proofs require auth
DROP POLICY IF EXISTS "Receipts are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Payment proofs are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated can view receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');
CREATE POLICY "Authenticated can upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Authenticated can view payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs');

-- 11. Storage: client-files and client-logos restricted to staff (admin/gerente)
DROP POLICY IF EXISTS "Authenticated users can view client files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload client files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete client files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload client logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete client logos" ON storage.objects;

CREATE POLICY "Staff can view client files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-files' AND (public.is_admin() OR public.is_gerente()));
CREATE POLICY "Staff can upload client files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files' AND (public.is_admin() OR public.is_gerente()));
CREATE POLICY "Staff can delete client files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-files' AND (public.is_admin() OR public.is_gerente()));
CREATE POLICY "Staff can upload client logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-logos' AND (public.is_admin() OR public.is_gerente()));
CREATE POLICY "Staff can delete client logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-logos' AND (public.is_admin() OR public.is_gerente()));
