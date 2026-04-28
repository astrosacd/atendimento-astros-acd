ALTER TABLE public.lead_hunter_campanhas 
ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT DEFAULT 'evolution',
ADD COLUMN IF NOT EXISTS meta_template_name TEXT,
ADD COLUMN IF NOT EXISTS meta_language_code TEXT DEFAULT 'pt_BR';

-- Add comment to explain columns
COMMENT ON COLUMN public.lead_hunter_campanhas.whatsapp_provider IS 'Provedor de disparo: evolution ou official';
COMMENT ON COLUMN public.lead_hunter_campanhas.meta_template_name IS 'Nome do template aprovado na Meta (apenas se provider for official)';
