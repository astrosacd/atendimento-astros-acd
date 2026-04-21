-- Excluir totalmente o cliente "cliente teste 123" e todos os seus dados relacionados
DO $$
DECLARE
  v_cid uuid := '9fd3ce1d-97bf-473d-97e2-d2120d23a500';
BEGIN
  -- Tabelas dependentes (sem ON DELETE CASCADE garantido)
  DELETE FROM public.client_payments WHERE cliente_id = v_cid;
  DELETE FROM public.client_history WHERE cliente_id = v_cid;
  DELETE FROM public.client_files WHERE cliente_id = v_cid;
  DELETE FROM public.client_purchases WHERE cliente_id = v_cid;
  DELETE FROM public.client_tasks WHERE cliente_id = v_cid;
  DELETE FROM public.client_followups WHERE cliente_id = v_cid;
  DELETE FROM public.client_social_credentials WHERE cliente_id = v_cid;
  DELETE FROM public.client_logos WHERE cliente_id = v_cid;
  DELETE FROM public.client_ai_logs WHERE cliente_id = v_cid;
  DELETE FROM public.client_pipeline WHERE cliente_id = v_cid;
  DELETE FROM public.client_recovery_attempts WHERE cliente_id = v_cid;
  DELETE FROM public.billing_logs WHERE cliente_id = v_cid;
  DELETE FROM public.automation_logs WHERE cliente_id = v_cid;

  -- Por fim, o cliente principal
  DELETE FROM public.clientes WHERE id = v_cid;
END $$;