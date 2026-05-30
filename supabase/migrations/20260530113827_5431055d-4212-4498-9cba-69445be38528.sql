CREATE TABLE public.qr_scan_insurance_payment_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baserow_row_id BIGINT NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pago', 'vencido')),
  observacao TEXT,
  marcado_por UUID,
  marcado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (baserow_row_id, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_scan_insurance_payment_status TO authenticated;
GRANT ALL ON public.qr_scan_insurance_payment_status TO service_role;

ALTER TABLE public.qr_scan_insurance_payment_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view insurance payment status"
ON public.qr_scan_insurance_payment_status FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert insurance payment status"
ON public.qr_scan_insurance_payment_status FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update insurance payment status"
ON public.qr_scan_insurance_payment_status FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete insurance payment status"
ON public.qr_scan_insurance_payment_status FOR DELETE
TO authenticated USING (true);

CREATE INDEX idx_qr_insurance_pay_status_lookup
ON public.qr_scan_insurance_payment_status (baserow_row_id, ano, mes);

CREATE TRIGGER update_qr_insurance_pay_status_updated_at
BEFORE UPDATE ON public.qr_scan_insurance_payment_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();