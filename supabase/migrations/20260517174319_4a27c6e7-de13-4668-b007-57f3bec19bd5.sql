ALTER TABLE public.ligacoes_campanhas
  ADD COLUMN IF NOT EXISTS delay_minutes_override integer,
  ADD COLUMN IF NOT EXISTS dia_alvo date NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_ligacoes_campanhas_dia_alvo ON public.ligacoes_campanhas(dia_alvo);