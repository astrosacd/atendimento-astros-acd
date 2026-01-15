-- Adicionar campo de moeda na tabela proposals
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';

-- Adicionar constraint para garantir valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_currency_check'
  ) THEN
    ALTER TABLE public.proposals 
    ADD CONSTRAINT proposals_currency_check CHECK (currency IN ('BRL', 'USD'));
  END IF;
END $$;