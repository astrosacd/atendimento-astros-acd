CREATE OR REPLACE FUNCTION public.purge_old_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reminder int := 0;
  v_automation int := 0;
  v_billing int := 0;
  v_cn_history int := 0;
BEGIN
  DELETE FROM public.consulta_numeros_reminder_logs
  WHERE sent_at < now() - interval '90 days';
  GET DIAGNOSTICS v_reminder = ROW_COUNT;

  DELETE FROM public.automation_logs
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_automation = ROW_COUNT;

  DELETE FROM public.billing_logs
  WHERE sent_at < now() - interval '90 days';
  GET DIAGNOSTICS v_billing = ROW_COUNT;

  DELETE FROM public.consulta_numeros_history
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_cn_history = ROW_COUNT;

  RETURN jsonb_build_object(
    'consulta_numeros_reminder_logs', v_reminder,
    'automation_logs', v_automation,
    'billing_logs', v_billing,
    'consulta_numeros_history', v_cn_history,
    'executed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_logs() TO service_role;

CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON public.automation_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_billing_logs_sent_at ON public.billing_logs (sent_at);
CREATE INDEX IF NOT EXISTS idx_cn_history_created_at ON public.consulta_numeros_history (created_at);

SELECT cron.unschedule('purge-old-logs-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-logs-daily');

SELECT cron.schedule('purge-old-logs-daily', '20 4 * * *', $$SELECT public.purge_old_logs();$$);