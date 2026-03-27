DROP POLICY IF EXISTS "Service role can insert payment links" ON public.payment_links;

DROP POLICY IF EXISTS "Authenticated users can delete share tokens" ON public.payment_link_share_tokens;
CREATE POLICY "Owners or admins can delete share tokens"
ON public.payment_link_share_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = created_by OR public.is_admin());