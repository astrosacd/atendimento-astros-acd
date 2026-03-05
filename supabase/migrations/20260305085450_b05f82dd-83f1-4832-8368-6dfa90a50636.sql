-- Make cliente_id nullable to support leads (not yet registered)
ALTER TABLE public.client_pipeline ALTER COLUMN cliente_id DROP NOT NULL;

-- Add lead fields for non-registered contacts
ALTER TABLE public.client_pipeline ADD COLUMN IF NOT EXISTS lead_name TEXT;
ALTER TABLE public.client_pipeline ADD COLUMN IF NOT EXISTS lead_phone TEXT;
ALTER TABLE public.client_pipeline ADD COLUMN IF NOT EXISTS lead_email TEXT;
ALTER TABLE public.client_pipeline ADD COLUMN IF NOT EXISTS lead_produto TEXT;
ALTER TABLE public.client_pipeline ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT false;
ALTER TABLE public.client_pipeline ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;