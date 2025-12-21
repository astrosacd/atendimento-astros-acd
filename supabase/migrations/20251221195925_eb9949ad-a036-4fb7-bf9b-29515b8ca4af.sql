-- Make divulgador-media bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'divulgador-media';

-- Drop public access policy
DROP POLICY IF EXISTS "Public can view divulgador media" ON storage.objects;

-- Create authenticated-only access policy
CREATE POLICY "Authenticated users can view divulgador media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'divulgador-media');

-- Create admin management policy for divulgador media
CREATE POLICY "Admins can manage divulgador media"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'divulgador-media' AND public.is_admin())
WITH CHECK (bucket_id = 'divulgador-media' AND public.is_admin());