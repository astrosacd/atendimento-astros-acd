
ALTER TABLE public.qr_scan_config DROP COLUMN IF EXISTS qtd_max_por_dia;

CREATE OR REPLACE FUNCTION public.qr_scan_release_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan RECORD;
  v_ano int;
  v_mes int;
BEGIN
  IF NEW.status <> 'paid' OR COALESCE(OLD.status, '') = 'paid' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_scan
  FROM public.qr_scan_history
  WHERE payment_link_id = NEW.id::text
    AND payment_status = 'pendente'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.qr_scan_history
  SET payment_status = 'pago',
      paid_at = now(),
      updated_at = now()
  WHERE id = v_scan.id;

  v_ano := EXTRACT(YEAR FROM v_scan.scan_date)::int;
  v_mes := EXTRACT(MONTH FROM v_scan.scan_date)::int;

  INSERT INTO public.qr_scan_monthly_counter (baserow_row_id, ano, mes, qtd_gratis_usados, qtd_pagos)
  VALUES (v_scan.baserow_row_id, v_ano, v_mes, 0, 1)
  ON CONFLICT (baserow_row_id, ano, mes)
  DO UPDATE SET qtd_pagos = public.qr_scan_monthly_counter.qtd_pagos + 1,
                updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qr_scan_release_on_payment ON public.payment_links;
CREATE TRIGGER trg_qr_scan_release_on_payment
AFTER UPDATE ON public.payment_links
FOR EACH ROW
EXECUTE FUNCTION public.qr_scan_release_on_payment();
