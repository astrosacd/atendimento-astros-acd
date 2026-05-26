
-- Storage: payment-proofs (remove overly permissive policies)
DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their uploaded proofs" ON storage.objects;

CREATE POLICY "Admins or gerentes can upload payment proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (is_admin() OR is_gerente()));

-- (UPDATE policy "Admins or gerentes can update payment proofs" already exists)

-- Storage: receipts
DROP POLICY IF EXISTS "Authenticated can upload receipts" ON storage.objects;

CREATE POLICY "Admins or gerentes can upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (is_admin() OR is_gerente()));

-- instagram_settings: restrict to admins only (single shared integration)
DROP POLICY IF EXISTS "Users can view their own settings" ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.instagram_settings;

CREATE POLICY "Admins can view instagram settings"
  ON public.instagram_settings FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert instagram settings"
  ON public.instagram_settings FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update instagram settings"
  ON public.instagram_settings FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can delete instagram settings"
  ON public.instagram_settings FOR DELETE TO authenticated
  USING (is_admin());
