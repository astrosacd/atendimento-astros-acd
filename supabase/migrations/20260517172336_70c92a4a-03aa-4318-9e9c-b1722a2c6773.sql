
-- Configuração única (singleton via id fixo)
CREATE TABLE public.cobranca_ligacao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  roteiro_id uuid REFERENCES public.ligacoes_ia_roteiros(id) ON DELETE SET NULL,
  delay_minutes integer NOT NULL DEFAULT 5 CHECK (delay_minutes >= 0 AND delay_minutes <= 120),
  dias_disparo integer[] NOT NULL DEFAULT '{}',
  horario_inicio time NOT NULL DEFAULT '09:00',
  horario_fim time NOT NULL DEFAULT '18:00',
  apenas_cobranca_ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cobranca_ligacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cobranca_ligacao_config"
  ON public.cobranca_ligacao_config
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_cobranca_ligacao_config_updated
  BEFORE UPDATE ON public.cobranca_ligacao_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Linha singleton inicial
INSERT INTO public.cobranca_ligacao_config (enabled) VALUES (false);

-- Fila de ligações
CREATE TABLE public.ligacoes_agendadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  roteiro_id uuid REFERENCES public.ligacoes_ia_roteiros(id) ON DELETE SET NULL,
  dia_alvo date NOT NULL,
  tipo_d text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','finalizada','falhou','cancelada')),
  tentativas integer NOT NULL DEFAULT 0,
  historico_id uuid REFERENCES public.ligacoes_ia_historico(id) ON DELETE SET NULL,
  processada_em timestamptz,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, dia_alvo, tipo_d)
);

CREATE INDEX idx_ligacoes_agendadas_dia_status ON public.ligacoes_agendadas(dia_alvo, status);
CREATE INDEX idx_ligacoes_agendadas_cliente ON public.ligacoes_agendadas(cliente_id);

ALTER TABLE public.ligacoes_agendadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ligacoes_agendadas"
  ON public.ligacoes_agendadas
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_ligacoes_agendadas_updated
  BEFORE UPDATE ON public.ligacoes_agendadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
