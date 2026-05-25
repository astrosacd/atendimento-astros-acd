
-- sms_validation_logs
DROP POLICY IF EXISTS "Authenticated users can read sms_validation_logs" ON public.sms_validation_logs;
CREATE POLICY "Users can read their own sms_validation_logs"
ON public.sms_validation_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- shared_access_tokens (no created_by column → admin only)
DROP POLICY IF EXISTS "Authenticated users can read tokens" ON public.shared_access_tokens;
CREATE POLICY "Admins can read shared_access_tokens"
ON public.shared_access_tokens
FOR SELECT TO authenticated
USING (public.is_admin());

-- payment-proofs bucket
DROP POLICY IF EXISTS "Authenticated can view payment proofs" ON storage.objects;
CREATE POLICY "Admins or gerentes can view payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND (public.is_admin() OR public.is_gerente()));

CREATE POLICY "Admins or gerentes can update payment proofs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-proofs' AND (public.is_admin() OR public.is_gerente()));

CREATE POLICY "Admins or gerentes can delete payment proofs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND (public.is_admin() OR public.is_gerente()));

-- receipts bucket
DROP POLICY IF EXISTS "Authenticated can view receipts" ON storage.objects;
CREATE POLICY "Admins or gerentes can view receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND (public.is_admin() OR public.is_gerente()));
