-- Add comprovante_url to client_payments
ALTER TABLE public.client_payments 
ADD COLUMN comprovante_url TEXT;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment-proofs
CREATE POLICY "Payment proofs are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'payment-proofs');

CREATE POLICY "Authenticated users can upload payment proofs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their uploaded proofs" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');
