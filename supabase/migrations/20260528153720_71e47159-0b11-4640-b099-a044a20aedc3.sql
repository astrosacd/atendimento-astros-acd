
DROP POLICY IF EXISTS "Active coupons are publicly readable" ON public.gateway_coupons;
DROP POLICY IF EXISTS "Public can view active coupons" ON public.gateway_coupons;
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.gateway_coupons;

CREATE POLICY "Authenticated users can view active coupons"
ON public.gateway_coupons
FOR SELECT
TO authenticated
USING (status = 'active');

DROP POLICY IF EXISTS "Users can create scheduled sends" ON public.proposal_scheduled_sends;

CREATE POLICY "Users can create scheduled sends"
ON public.proposal_scheduled_sends
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_scheduled_sends.proposal_id
      AND (p.user_id = auth.uid() OR public.is_admin())
  )
);

DROP POLICY IF EXISTS "Operadores can view client files" ON storage.objects;
DROP POLICY IF EXISTS "Operadores can upload client files" ON storage.objects;
DROP POLICY IF EXISTS "Operadores can update client files" ON storage.objects;
DROP POLICY IF EXISTS "Operadores can delete client files" ON storage.objects;

CREATE POLICY "Operadores can view client files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'client-files' AND public.is_operador());

CREATE POLICY "Operadores can upload client files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-files' AND public.is_operador());

CREATE POLICY "Operadores can update client files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-files' AND public.is_operador());

CREATE POLICY "Operadores can delete client files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'client-files' AND public.is_operador());
