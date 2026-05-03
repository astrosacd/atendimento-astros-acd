CREATE TABLE public.shared_access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_access_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read a token by its value (to verify it)
CREATE POLICY "Public can read tokens by value"
ON public.shared_access_tokens
FOR SELECT
USING (true);

-- Allow authenticated users to create tokens
CREATE POLICY "Authenticated users can create tokens"
ON public.shared_access_tokens
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to delete their own tokens (optional, keeping it simple for now)
CREATE POLICY "Authenticated users can delete tokens"
ON public.shared_access_tokens
FOR DELETE
USING (auth.role() = 'authenticated');
