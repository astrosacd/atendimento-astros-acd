-- Adiciona campos de idioma/moeda/tipo aos roteiros de Ligações IA
ALTER TABLE public.ligacoes_ia_roteiros
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'brasileiro',
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL';

-- Validações leves (não-CHECK, via trigger é overkill; usamos constraint simples)
DO $$ BEGIN
  ALTER TABLE public.ligacoes_ia_roteiros
    ADD CONSTRAINT ligacoes_ia_roteiros_tipo_check CHECK (tipo IN ('brasileiro','estrangeiro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ligacoes_ia_roteiros
    ADD CONSTRAINT ligacoes_ia_roteiros_idioma_check CHECK (idioma IN ('pt-BR','en-US','es-ES'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ligacoes_ia_roteiros
    ADD CONSTRAINT ligacoes_ia_roteiros_moeda_check CHECK (moeda IN ('BRL','USD','EUR'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_roteiros_moeda_ativo ON public.ligacoes_ia_roteiros(moeda) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_roteiros_idioma_ativo ON public.ligacoes_ia_roteiros(idioma) WHERE ativo;