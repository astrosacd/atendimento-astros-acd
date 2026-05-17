CREATE POLICY "Authenticated users can update payment links"
ON public.payment_links
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);