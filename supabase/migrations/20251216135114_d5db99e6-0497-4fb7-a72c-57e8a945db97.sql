-- Função para atualizar o horário do cron job
CREATE OR REPLACE FUNCTION public.update_billing_cron_schedule(p_hour integer, p_minute integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_schedule TEXT;
  v_utc_hour INTEGER;
BEGIN
  -- Converter de Brasília (UTC-3) para UTC
  v_utc_hour := p_hour + 3;
  IF v_utc_hour >= 24 THEN
    v_utc_hour := v_utc_hour - 24;
  END IF;
  
  -- Formato cron: minuto hora * * *
  v_schedule := p_minute || ' ' || v_utc_hour || ' * * *';
  
  -- Remover o job existente se existir
  PERFORM cron.unschedule('daily-billing-cron');
  
  -- Criar novo job com o horário atualizado
  PERFORM cron.schedule(
    'daily-billing-cron',
    v_schedule,
    $$SELECT public.execute_billing_cron();$$
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$function$;