ALTER TABLE public.numeros_aquecimento_modelos
ADD COLUMN IF NOT EXISTS capacidade_whatsapp integer NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.numeros_aquecimento_modelos.capacidade_whatsapp IS 'Quantidade de WhatsApp (normal + business) que este modelo de aparelho comporta';