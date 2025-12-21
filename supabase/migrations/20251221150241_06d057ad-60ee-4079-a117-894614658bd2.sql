-- Criar função para atualizar o cron de carrinho abandonado
CREATE OR REPLACE FUNCTION public.update_gateway_abandoned_cart_cron(p_interval_minutes integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule TEXT;
BEGIN
  IF p_interval_minutes < 1 OR p_interval_minutes > 60 THEN
    RAISE EXCEPTION 'Intervalo deve ser entre 1 e 60 minutos';
  END IF;
  
  v_schedule := '*/' || p_interval_minutes || ' * * * *';
  
  BEGIN
    PERFORM cron.unschedule('gateway-abandoned-cart-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'gateway-abandoned-cart-cron',
    v_schedule,
    'SELECT public.execute_gateway_abandoned_cart();'
  );
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao atualizar cron: %', SQLERRM;
    RETURN false;
END;
$$;

-- Criar função para obter o schedule atual do cron de carrinho abandonado
CREATE OR REPLACE FUNCTION public.get_gateway_abandoned_cart_cron_schedule()
RETURNS TABLE(schedule text, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.schedule::text, c.jobname::text as job_name
  FROM cron.job c
  WHERE c.jobname = 'gateway-abandoned-cart-cron'
  LIMIT 1;
END;
$$;