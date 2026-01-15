-- Create bucket for proposal images
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-images', 'proposal-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload images
CREATE POLICY "Authenticated users can upload proposal images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proposal-images' 
  AND auth.role() = 'authenticated'
);

-- Create policy for anyone to view proposal images (public)
CREATE POLICY "Anyone can view proposal images"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposal-images');

-- Create policy for authenticated users to update their own images
CREATE POLICY "Authenticated users can update proposal images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'proposal-images' 
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to delete their own images
CREATE POLICY "Authenticated users can delete proposal images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proposal-images' 
  AND auth.role() = 'authenticated'
);