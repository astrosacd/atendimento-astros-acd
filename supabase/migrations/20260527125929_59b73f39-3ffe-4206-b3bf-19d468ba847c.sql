
-- 1. Colunas em consulta_numeros_cache (flag auto-hospedado)
ALTER TABLE public.consulta_numeros_cache
  ADD COLUMN IF NOT EXISTS auto_hospedado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_hospedado_observacao text,
  ADD COLUMN IF NOT EXISTS auto_hospedado_marcado_em timestamptz,
  ADD COLUMN IF NOT EXISTS auto_hospedado_marcado_por uuid;

CREATE INDEX IF NOT EXISTS idx_consulta_numeros_cache_auto_hospedado
  ON public.consulta_numeros_cache(auto_hospedado) WHERE auto_hospedado = true;

-- 2. qr_scan_config (singleton)
CREATE TABLE public.qr_scan_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qtd_gratis_por_mes integer NOT NULL DEFAULT 4,
  qtd_max_por_dia integer NOT NULL DEFAULT 1,
  valor_excedente numeric(10,2) NOT NULL DEFAULT 14.97,
  payment_provider_default text NOT NULL DEFAULT 'mercadopago' CHECK (payment_provider_default IN ('mercadopago','stripe')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_scan_config TO authenticated;
GRANT ALL ON public.qr_scan_config TO service_role;
ALTER TABLE public.qr_scan_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_scan_config_select_auth" ON public.qr_scan_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "qr_scan_config_modify_admin" ON public.qr_scan_config
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_qr_scan_config_updated
  BEFORE UPDATE ON public.qr_scan_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.qr_scan_config (qtd_gratis_por_mes, qtd_max_por_dia, valor_excedente, payment_provider_default)
VALUES (4, 1, 14.97, 'mercadopago');

-- 3. qr_scan_history
CREATE TABLE public.qr_scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baserow_row_id bigint NOT NULL,
  numero text NOT NULL,
  cliente_nome text,
  scan_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  tipo text NOT NULL CHECK (tipo IN ('gratis','pago')),
  valor_cobrado numeric(10,2),
  payment_status text NOT NULL DEFAULT 'nao_aplica' CHECK (payment_status IN ('nao_aplica','pendente','pago','cancelado')),
  payment_method text CHECK (payment_method IN ('link_mp','link_stripe','manual_pix','manual_saldo','manual_outro')),
  payment_link_id uuid,
  payment_manual_observacao text,
  payment_comprovante_url text,
  paid_at timestamptz,
  confirmed_by uuid,
  operador_user_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_scan_history TO authenticated;
GRANT ALL ON public.qr_scan_history TO service_role;
ALTER TABLE public.qr_scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_scan_history_select_auth" ON public.qr_scan_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "qr_scan_history_insert_auth" ON public.qr_scan_history
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "qr_scan_history_update_auth" ON public.qr_scan_history
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qr_scan_history_delete_admin" ON public.qr_scan_history
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX idx_qr_scan_history_row ON public.qr_scan_history(baserow_row_id);
CREATE INDEX idx_qr_scan_history_date ON public.qr_scan_history(scan_date);
CREATE INDEX idx_qr_scan_history_status ON public.qr_scan_history(payment_status);
CREATE UNIQUE INDEX idx_qr_scan_history_unique_per_day
  ON public.qr_scan_history(baserow_row_id, scan_date)
  WHERE payment_status IN ('nao_aplica','pendente','pago');

CREATE TRIGGER trg_qr_scan_history_updated
  BEFORE UPDATE ON public.qr_scan_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. qr_scan_monthly_counter
CREATE TABLE public.qr_scan_monthly_counter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baserow_row_id bigint NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  qtd_gratis_usados integer NOT NULL DEFAULT 0,
  qtd_pagos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(baserow_row_id, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_scan_monthly_counter TO authenticated;
GRANT ALL ON public.qr_scan_monthly_counter TO service_role;
ALTER TABLE public.qr_scan_monthly_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_scan_monthly_counter_select_auth" ON public.qr_scan_monthly_counter
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "qr_scan_monthly_counter_modify_auth" ON public.qr_scan_monthly_counter
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_qr_scan_counter_updated
  BEFORE UPDATE ON public.qr_scan_monthly_counter
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
