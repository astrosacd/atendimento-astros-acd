ALTER TABLE public.qr_scan_checkins_diarios
  DROP CONSTRAINT IF EXISTS qr_scan_checkins_diarios_status_conexao_check;

ALTER TABLE public.qr_scan_checkins_diarios
  ADD CONSTRAINT qr_scan_checkins_diarios_status_conexao_check
  CHECK (status_conexao = ANY (ARRAY['conectado'::text, 'desconectado'::text, 'desconectado_cliente'::text]));