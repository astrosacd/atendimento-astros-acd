
-- Tornar cliente_id opcional para suportar contatos manuais
ALTER TABLE public.ligacoes_agendadas ALTER COLUMN cliente_id DROP NOT NULL;

-- Adicionar campos de contato manual
ALTER TABLE public.ligacoes_agendadas
  ADD COLUMN IF NOT EXISTS nome_manual text,
  ADD COLUMN IF NOT EXISTS numero_manual text;

-- Garantir que ou cliente_id ou numero_manual esteja preenchido
ALTER TABLE public.ligacoes_agendadas
  DROP CONSTRAINT IF EXISTS ligacoes_agendadas_destino_check;
ALTER TABLE public.ligacoes_agendadas
  ADD CONSTRAINT ligacoes_agendadas_destino_check
  CHECK (cliente_id IS NOT NULL OR numero_manual IS NOT NULL);

-- Evitar duplicatas em campanhas manuais (mesmo número, mesma campanha)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ligacoes_agendadas_uq_campanha_manual
  ON public.ligacoes_agendadas (campanha_id, numero_manual)
  WHERE campanha_id IS NOT NULL AND numero_manual IS NOT NULL;
