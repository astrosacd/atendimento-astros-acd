ALTER TABLE public.qr_scan_checkins_diarios
  ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES public.numeros_aquecimento_modelos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS qr_scan_checkins_modelo_id_idx
  ON public.qr_scan_checkins_diarios(modelo_id);

ALTER TABLE public.qr_scan_checkins_diarios
  ALTER COLUMN aparelho_id DROP NOT NULL;