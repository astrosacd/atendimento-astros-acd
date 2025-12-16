-- Função para atualizar o schedule do CRON do divulgador
CREATE OR REPLACE FUNCTION public.update_divulgador_cron_schedule(p_interval_minutes integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_schedule TEXT;
BEGIN
  IF p_interval_minutes < 1 OR p_interval_minutes > 60 THEN
    RAISE EXCEPTION 'Intervalo deve ser entre 1 e 60 minutos';
  END IF;
  
  v_schedule := '*/' || p_interval_minutes || ' * * * *';
  
  BEGIN
    PERFORM cron.unschedule('divulgador-send-messages-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'divulgador-send-messages-cron',
    v_schedule,
    'SELECT public.execute_divulgador_cron();'
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$func$;

-- Função para desativar o CRON do divulgador
CREATE OR REPLACE FUNCTION public.disable_divulgador_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  PERFORM cron.unschedule('divulgador-send-messages-cron');
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$func$;