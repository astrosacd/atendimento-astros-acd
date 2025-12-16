-- Create storage bucket for divulgador media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('divulgador-media', 'divulgador-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload divulgador media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'divulgador-media');

-- Create policy to allow public access to read media
CREATE POLICY "Public can view divulgador media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'divulgador-media');

-- Create policy to allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete divulgador media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'divulgador-media');