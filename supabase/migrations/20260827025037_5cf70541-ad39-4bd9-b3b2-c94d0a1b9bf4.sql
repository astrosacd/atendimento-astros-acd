CREATE OR REPLACE FUNCTION public.execute_minute_automations_dispatcher()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.execute_gateway_abandoned_cart();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'gateway-abandoned-cart failed to dispatch: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.execute_consulta_numeros_reminder();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'consulta-numeros-reminder failed to dispatch: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.trigger_auto_sync_consulta_numeros();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto-sync-consulta-numeros failed to dispatch: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.execute_divulgador_cron();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'divulgador-send-messages failed to dispatch: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.execute_followups_cron();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'process-followups failed to dispatch: %', SQLERRM;
  END;
END;
$$;

DO $$
DECLARE
  v_job_name text;
BEGIN
  FOREACH v_job_name IN ARRAY ARRAY[
    'gateway-abandoned-cart-cron',
    'consulta-numeros-reminder-cron',
    'auto-sync-consulta-numeros',
    'divulgador-send-messages-cron',
    'process-followups-cron',
    'minute-automations-dispatcher'
  ]
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_job_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'minute-automations-dispatcher',
  '* * * * *',
  'SELECT public.execute_minute_automations_dispatcher();'
);