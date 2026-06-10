
-- 1) sms_validation_result_shares: drop public-role SELECT (keep authenticated; public uses get_sms_result_share RPC)
DROP POLICY IF EXISTS "Anyone can view valid result shares" ON public.sms_validation_result_shares;

-- 2) gateway_coupon_usages: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service can insert coupon usages" ON public.gateway_coupon_usages;
CREATE POLICY "Service role can insert coupon usages"
  ON public.gateway_coupon_usages
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3) client_recovery_webhooks: restrict to admin only (contains secret_key)
DROP POLICY IF EXISTS "Authenticated users can manage recovery webhooks" ON public.client_recovery_webhooks;
CREATE POLICY "Admins manage recovery webhooks"
  ON public.client_recovery_webhooks
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4) proposal_webhooks: restrict to admin only
DROP POLICY IF EXISTS "Authenticated users can manage proposal webhooks" ON public.proposal_webhooks;
CREATE POLICY "Admins manage proposal webhooks"
  ON public.proposal_webhooks
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5) system_settings: tighten — non-admin authenticated reads only safe public-ish keys
DROP POLICY IF EXISTS "Authenticated can read non-secret settings" ON public.system_settings;
CREATE POLICY "Authenticated can read whitelisted settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (
    key = ANY (ARRAY[
      'recaptcha_site_key',
      'recaptcha_enabled',
      'app_name',
      'app_logo_url',
      'app_theme'
    ])
  );

-- 6) payment-proofs storage bucket: drop "Public Access" policy (bucket is now private)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- 7) client-files storage: scope gerente SELECT to own clients
DROP POLICY IF EXISTS "Staff can view client files" ON storage.objects;
CREATE POLICY "Admins can view client files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-files' AND public.is_admin());

CREATE POLICY "Gerentes can view own client files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-files'
    AND public.is_gerente()
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.created_by = auth.uid()
        AND (storage.foldername(name))[1] = c.id::text
    )
  );
