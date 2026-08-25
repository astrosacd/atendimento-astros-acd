CREATE INDEX IF NOT EXISTS idx_cn_reminder_logs_sent_at ON public.consulta_numeros_reminder_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_reminder_logs_channel_status_sent ON public.consulta_numeros_reminder_logs (channel, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_checkins_data_created ON public.qr_scan_checkins_diarios (data_checkin DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_checkins_numero ON public.qr_scan_checkins_diarios (numero);
CREATE INDEX IF NOT EXISTS idx_cn_cache_auto_hospedado ON public.consulta_numeros_cache (auto_hospedado) WHERE auto_hospedado = true;
ANALYZE public.consulta_numeros_reminder_logs;
ANALYZE public.qr_scan_checkins_diarios;
ANALYZE public.consulta_numeros_cache;