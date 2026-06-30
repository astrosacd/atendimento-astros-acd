
-- Tabela de horário comercial (semana e sábado)
CREATE TABLE IF NOT EXISTS public.horario_comercial (
  id SERIAL PRIMARY KEY,
  semana_inicio TIME NOT NULL DEFAULT '09:00',
  semana_fim TIME NOT NULL DEFAULT '18:00',
  sabado_inicio TIME,
  sabado_fim TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.horario_comercial TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.horario_comercial TO authenticated;
GRANT ALL ON SEQUENCE public.horario_comercial_id_seq TO authenticated, service_role;
GRANT ALL ON public.horario_comercial TO service_role;

ALTER TABLE public.horario_comercial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler horario"
  ON public.horario_comercial FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins gerenciam horario"
  ON public.horario_comercial FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_horario_comercial_updated_at
  BEFORE UPDATE ON public.horario_comercial
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de bloqueios de datas
CREATE TABLE IF NOT EXISTS public.bloqueios (
  id BIGSERIAL PRIMARY KEY,
  data DATE NOT NULL,
  dia_todo BOOLEAN NOT NULL DEFAULT true,
  hora_inicio TIME,
  hora_fim TIME,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_data ON public.bloqueios(data);

GRANT SELECT ON public.bloqueios TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.bloqueios TO authenticated;
GRANT ALL ON SEQUENCE public.bloqueios_id_seq TO authenticated, service_role;
GRANT ALL ON public.bloqueios TO service_role;

ALTER TABLE public.bloqueios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler bloqueios"
  ON public.bloqueios FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins gerenciam bloqueios"
  ON public.bloqueios FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_bloqueios_updated_at
  BEFORE UPDATE ON public.bloqueios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed do registro único de horário (apenas se vazio)
INSERT INTO public.horario_comercial (semana_inicio, semana_fim, sabado_inicio, sabado_fim)
SELECT '10:00'::time, '17:00'::time, '09:00'::time, '12:00'::time
WHERE NOT EXISTS (SELECT 1 FROM public.horario_comercial);
