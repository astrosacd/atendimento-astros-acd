-- Allow admins to manage backups in storage
CREATE POLICY "Admins can manage backups"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'backups' AND 
  (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
)
WITH CHECK (
  bucket_id = 'backups' AND 
  (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
);
