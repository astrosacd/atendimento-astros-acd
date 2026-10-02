CREATE POLICY "Staff can read public bucket objects" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id IN ('gateway-products','proposal-images','client-logos','instagram-media') AND public.is_staff());