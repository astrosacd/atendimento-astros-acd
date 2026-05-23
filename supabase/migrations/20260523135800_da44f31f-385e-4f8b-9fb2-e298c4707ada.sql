INSERT INTO public.system_permissions (key, name, description, category)
VALUES (
  'cleanup_cobranca_orphan_payments',
  'Limpar Pagamentos Órfãos de Cobrança',
  'Permite visualizar e remover pagamentos antigos/órfãos do módulo de cobrança.',
  'cobranca'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_name, permission_key)
SELECT r.name, 'cleanup_cobranca_orphan_payments'
FROM public.custom_roles r
WHERE r.name IN ('admin','gerente')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.cleanup_old_billing_webhook_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.billing_webhook_logs
  WHERE created_at < now() - interval '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_cobranca_orphan_payments(p_days_old integer DEFAULT 30)
RETURNS TABLE(
  id uuid,
  cliente_id uuid,
  cliente_nome text,
  payment_id text,
  payment_type text,
  amount numeric,
  status text,
  billing_date date,
  created_at timestamptz,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'gerente') OR public.has_custom_role(auth.uid(), 'admin') OR public.has_custom_role(auth.uid(), 'gerente')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar pagamentos órfãos';
  END IF;

  v_days := greatest(coalesce(p_days_old, 30), 7);

  RETURN QUERY
  SELECT
    cp.id,
    cp.cliente_id,
    c.nome::text AS cliente_nome,
    cp.payment_id,
    cp.payment_type,
    cp.amount,
    cp.status,
    cp.billing_date,
    cp.created_at,
    CASE
      WHEN cp.cliente_id IS NULL THEN 'Sem cliente vinculado'
      WHEN c.id IS NULL THEN 'Cliente não encontrado'
      WHEN cp.payment_id ~* '^(pix|link|stripe|boleto)_[0-9a-f-]{36}_[0-9]+$' AND cp.preference_id IS NULL THEN 'ID sintético sem vínculo real no gateway'
      WHEN cp.status IN ('cancelled','rejected') AND cp.created_at < now() - make_interval(days => v_days) THEN 'Cancelado/rejeitado antigo'
      WHEN cp.status = 'pending' AND cp.created_at < now() - make_interval(days => greatest(v_days, 60)) THEN 'Pendente antigo sem confirmação'
      ELSE 'Candidato antigo sem quitação'
    END::text AS reason
  FROM public.client_payments cp
  LEFT JOIN public.clientes c ON c.id = cp.cliente_id
  WHERE cp.paid_at IS NULL
    AND cp.status IN ('pending','cancelled','rejected')
    AND (
      cp.cliente_id IS NULL
      OR c.id IS NULL
      OR (cp.payment_id ~* '^(pix|link|stripe|boleto)_[0-9a-f-]{36}_[0-9]+$' AND cp.preference_id IS NULL AND cp.created_at < now() - make_interval(days => v_days))
      OR (cp.status IN ('cancelled','rejected') AND cp.created_at < now() - make_interval(days => v_days))
      OR (cp.status = 'pending' AND cp.created_at < now() - make_interval(days => greatest(v_days, 60)))
    )
  ORDER BY cp.created_at ASC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_cobranca_orphan_payments(p_days_old integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_deleted integer := 0;
  v_days integer;
BEGIN
  IF NOT (public.is_admin() OR public.has_role(auth.uid(), 'gerente') OR public.has_custom_role(auth.uid(), 'admin') OR public.has_custom_role(auth.uid(), 'gerente')) THEN
    RAISE EXCEPTION 'Sem permissão para limpar pagamentos órfãos';
  END IF;

  v_days := greatest(coalesce(p_days_old, 30), 7);

  SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[])
  INTO v_ids
  FROM public.preview_cobranca_orphan_payments(v_days) p;

  DELETE FROM public.client_payments cp
  WHERE cp.id = ANY(v_ids)
    AND cp.paid_at IS NULL
    AND cp.status IN ('pending','cancelled','rejected');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted,
    'daysOld', v_days,
    'deletedIds', coalesce(v_ids, ARRAY[]::uuid[])
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-webhook-logs-retention-90d') THEN
    PERFORM cron.unschedule('billing-webhook-logs-retention-90d');
  END IF;

  PERFORM cron.schedule(
    'billing-webhook-logs-retention-90d',
    '15 3 * * *',
    'SELECT public.cleanup_old_billing_webhook_logs();'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Cron de retenção não configurado nesta execução: %', SQLERRM;
END $$;