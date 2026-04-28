-- Create table for Meta credentials
CREATE TABLE IF NOT EXISTS public.meta_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token TEXT NOT NULL,
    phone_number_id TEXT NOT NULL,
    waba_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for Template mapping
CREATE TABLE IF NOT EXISTS public.meta_template_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE, -- e.g., 'message_d_menos_3', 'message_d_zero'
    template_name TEXT NOT NULL,
    language_code TEXT DEFAULT 'pt_BR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meta_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_template_mapping ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (Allow all authenticated users for now, following project pattern)
CREATE POLICY "Allow all authenticated users on meta_credentials"
ON public.meta_credentials
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all authenticated users on meta_template_mapping"
ON public.meta_template_mapping
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_meta_credentials
BEFORE UPDATE ON public.meta_credentials
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_meta_template_mapping
BEFORE UPDATE ON public.meta_template_mapping
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Initial event keys for templates
INSERT INTO public.meta_template_mapping (event_key, template_name)
VALUES 
('message_d_menos_3', 'cobranca_vencimento_proximo'),
('message_d_zero', 'cobranca_vencimento_hoje'),
('message_d_mais_1', 'cobranca_vencida_1d'),
('message_d_mais_2', 'cobranca_vencida_2d'),
('message_d_mais_15', 'cobranca_vencida_15d'),
('message_d_mais_30', 'cobranca_vencida_30d')
ON CONFLICT (event_key) DO NOTHING;
