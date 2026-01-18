-- Adicionar novos campos de branding
ALTER TABLE public.proposal_branding
ADD COLUMN IF NOT EXISTS cover_background_url TEXT,
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS footer_contact TEXT,
ADD COLUMN IF NOT EXISTS footer_website TEXT,
ADD COLUMN IF NOT EXISTS footer_social JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS client_logos JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]';

-- Adicionar campos de segurança e validade nas propostas
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS is_password_protected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;