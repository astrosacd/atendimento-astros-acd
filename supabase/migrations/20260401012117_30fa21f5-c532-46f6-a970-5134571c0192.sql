
-- Table for sharing SMS validation results via temporary links
CREATE TABLE public.sms_validation_result_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  results JSONB NOT NULL,
  message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_validation_result_shares ENABLE ROW LEVEL SECURITY;

-- Public can read valid (non-expired) shares by token
CREATE POLICY "Anyone can view valid result shares"
  ON public.sms_validation_result_shares FOR SELECT
  USING (expires_at > now());

-- Authenticated users can create shares
CREATE POLICY "Authenticated users can create result shares"
  ON public.sms_validation_result_shares FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RPC to validate and get result share by token
CREATE OR REPLACE FUNCTION public.get_sms_result_share(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_share RECORD;
BEGIN
  SELECT * INTO v_share
  FROM public.sms_validation_result_shares
  WHERE token = p_token AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'results', v_share.results,
    'message', v_share.message,
    'expires_at', v_share.expires_at,
    'created_at', v_share.created_at
  );
END;
$$;

-- Client logos table
CREATE TABLE public.client_logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client logos"
  ON public.client_logos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage client logos"
  ON public.client_logos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete client logos"
  ON public.client_logos FOR DELETE
  TO authenticated
  USING (true);

-- Storage bucket for client logos
INSERT INTO storage.buckets (id, name, public) VALUES ('client-logos', 'client-logos', true);

CREATE POLICY "Anyone can view client logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-logos');

CREATE POLICY "Authenticated users can upload client logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-logos');

CREATE POLICY "Authenticated users can delete client logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-logos');
