-- Criar função que executa o billing cron com o secret do banco
CREATE OR REPLACE FUNCTION public.execute_billing_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cron_secret TEXT;
  v_supabase_url TEXT := 'https://udxaxemoozddkwpitngq.supabase.co';
BEGIN
  -- Buscar o CRON_SECRET da tabela billing_config
  SELECT config_value INTO v_cron_secret
  FROM billing_config
  WHERE config_key = 'cron_secret';
  
  -- Se não encontrou, não executa
  IF v_cron_secret IS NULL OR v_cron_secret = '' THEN
    RAISE NOTICE 'CRON_SECRET não configurado em billing_config';
    RETURN;
  END IF;
  
  -- Fazer a chamada HTTP para a edge function
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/billing-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;