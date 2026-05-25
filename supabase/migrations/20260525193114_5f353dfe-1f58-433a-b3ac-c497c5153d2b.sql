
-- 1) password_reset_tokens: scope policies to authenticated only
DROP POLICY IF EXISTS "Admins can view password reset tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Admins can update password reset tokens" ON public.password_reset_tokens;

CREATE POLICY "Admins can view password reset tokens"
ON public.password_reset_tokens
FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can update password reset tokens"
ON public.password_reset_tokens
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 2) system_settings: restrict anon read to explicit whitelist
DROP POLICY IF EXISTS "Public read non-secret settings" ON public.system_settings;

CREATE POLICY "Anon can read public recaptcha settings"
ON public.system_settings
FOR SELECT
TO anon
USING (key IN ('recaptcha_site_key', 'recaptcha_enabled'));

CREATE POLICY "Authenticated can read non-secret settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (key <> 'recaptcha_secret_key');

-- 3) storage.objects: add UPDATE policy for client-files bucket
CREATE POLICY "Staff can update client files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'client-files'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'))
)
WITH CHECK (
  bucket_id = 'client-files'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'))
);
