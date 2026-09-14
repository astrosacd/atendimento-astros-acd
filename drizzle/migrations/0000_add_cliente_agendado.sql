ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS status_cliente TEXT NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS servico_agendado TEXT,
  ADD COLUMN IF NOT EXISTS data_agendamento DATE,
  ADD COLUMN IF NOT EXISTS convertido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS convertido_de TEXT;

CREATE INDEX IF NOT EXISTS idx_clientes_status_cliente ON public.clientes (status_cliente);