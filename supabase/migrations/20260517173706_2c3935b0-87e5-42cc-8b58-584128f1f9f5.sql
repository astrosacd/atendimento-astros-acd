-- Tabela de campanhas de ligação
CREATE TABLE IF NOT EXISTS public.ligacoes_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  roteiro_id uuid REFERENCES public.ligacoes_ia_roteiros(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','finalizada','cancelada')),
  total int NOT NULL DEFAULT 0,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ligacoes_campanhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage ligacoes_campanhas" ON public.ligacoes_campanhas;
CREATE POLICY "Admins manage ligacoes_campanhas"
  ON public.ligacoes_campanhas
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER trg_ligacoes_campanhas_updated
  BEFORE UPDATE ON public.ligacoes_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campanha_id em ligacoes_agendadas
ALTER TABLE public.ligacoes_agendadas
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES public.ligacoes_campanhas(id) ON DELETE CASCADE;

-- A unique antiga (cliente_id, dia_alvo, tipo_d) impede múltiplas campanhas no mesmo dia.
-- Recriar como parcial: só vale para rows sem campanha (fluxo de cobrança automática).
ALTER TABLE public.ligacoes_agendadas
  DROP CONSTRAINT IF EXISTS ligacoes_agendadas_cliente_id_dia_alvo_tipo_d_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ligacoes_agendadas_uq_cobranca
  ON public.ligacoes_agendadas (cliente_id, dia_alvo, tipo_d)
  WHERE campanha_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ligacoes_agendadas_uq_campanha
  ON public.ligacoes_agendadas (campanha_id, cliente_id)
  WHERE campanha_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ligacoes_agendadas_campanha
  ON public.ligacoes_agendadas (campanha_id);

-- Permissão para campanhas
INSERT INTO public.system_permissions (key, name, description, category) VALUES
  ('manage_ligacoes_campanhas', 'Gerenciar campanhas de ligação', 'Criar, executar e cancelar campanhas em massa de ligações IA', 'Ligações IA')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;

INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('admin', 'manage_ligacoes_campanhas')
ON CONFLICT DO NOTHING;