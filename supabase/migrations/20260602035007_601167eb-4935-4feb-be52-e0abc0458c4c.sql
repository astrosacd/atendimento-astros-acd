-- Garantir que o bucket payment-proofs seja público
UPDATE storage.buckets SET public = true WHERE id = 'payment-proofs';

-- Remover políticas antigas se existirem para evitar conflitos ao recriar
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;

-- Recriar políticas de acesso
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE USING (bucket_id = 'payment-proofs');
