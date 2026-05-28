ALTER TABLE public.qr_scan_config ADD COLUMN qtd_por_dia INTEGER NOT NULL DEFAULT 2;

-- Update existing config if it exists
UPDATE public.qr_scan_config SET qtd_por_dia = 2 WHERE qtd_por_dia IS NULL;
