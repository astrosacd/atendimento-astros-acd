-- Allow admins to resolve/update billing logs from the app
CREATE POLICY "Admins can update billing logs"
ON public.billing_logs
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());