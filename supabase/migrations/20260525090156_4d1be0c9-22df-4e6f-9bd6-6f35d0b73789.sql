
-- 1. client_ai_logs: restrict SELECT to admin or owner
DROP POLICY IF EXISTS "Users can view AI logs" ON public.client_ai_logs;
CREATE POLICY "Users can view their AI logs or admin all"
ON public.client_ai_logs
FOR SELECT
TO authenticated
USING (is_admin() OR auth.uid() = user_id);

-- 2. pipeline_chatwoot_config: restrict INSERT/UPDATE to admins only
DROP POLICY IF EXISTS "Admins can insert chatwoot config" ON public.pipeline_chatwoot_config;
DROP POLICY IF EXISTS "Admins can update chatwoot config" ON public.pipeline_chatwoot_config;
CREATE POLICY "Admins can insert chatwoot config"
ON public.pipeline_chatwoot_config
FOR INSERT
TO authenticated
WITH CHECK (is_admin());
CREATE POLICY "Admins can update chatwoot config"
ON public.pipeline_chatwoot_config
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
CREATE POLICY "Admins can delete chatwoot config"
ON public.pipeline_chatwoot_config
FOR DELETE
TO authenticated
USING (is_admin());

-- 3. gateway_settings: explicit deny for anon, ensure no public access
CREATE POLICY "Deny anon access to gateway_settings"
ON public.gateway_settings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 4. Receipts and payment-proofs buckets -> private
UPDATE storage.buckets SET public = false WHERE id IN ('receipts','payment-proofs');
