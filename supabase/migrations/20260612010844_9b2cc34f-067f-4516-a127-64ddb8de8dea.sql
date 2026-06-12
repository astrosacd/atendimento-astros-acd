
-- Tabela de check-in diário de números nos aparelhos físicos
CREATE TABLE public.qr_scan_checkins_diarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL,
  baserow_row_id BIGINT,
  cliente_nome TEXT,
  aparelho_id UUID REFERENCES public.numeros_aquecimento_aparelhos(id) ON DELETE SET NULL,
  modelo_snapshot TEXT,
  tipo_slot TEXT NOT NULL CHECK (tipo_slot IN ('normal','business','clone')),
  status_conexao TEXT NOT NULL DEFAULT 'conectado' CHECK (status_conexao IN ('conectado','desconectado')),
  status_geral TEXT,
  data_checkin DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Fortaleza')::date,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkins_numero ON public.qr_scan_checkins_diarios(numero);
CREATE INDEX idx_checkins_data ON public.qr_scan_checkins_diarios(data_checkin DESC);
CREATE INDEX idx_checkins_aparelho ON public.qr_scan_checkins_diarios(aparelho_id);
CREATE INDEX idx_checkins_status ON public.qr_scan_checkins_diarios(status_conexao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_scan_checkins_diarios TO authenticated;
GRANT ALL ON public.qr_scan_checkins_diarios TO service_role;

ALTER TABLE public.qr_scan_checkins_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam checkins"
  ON public.qr_scan_checkins_diarios FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Usuarios autenticados leem checkins"
  ON public.qr_scan_checkins_diarios FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.update_qr_checkins_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_checkins_updated_at
  BEFORE UPDATE ON public.qr_scan_checkins_diarios
  FOR EACH ROW EXECUTE FUNCTION public.update_qr_checkins_updated_at();
