
-- pg_trgm for similarity()
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Helper to normalize phone (only digits, last 11)
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(RIGHT(regexp_replace(coalesce(p,''), '[^0-9]', '', 'g'), 11), '')
$$;

-- Consolidated search
CREATE OR REPLACE FUNCTION public.buscar_investimentos_cliente(
  p_nome text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := public.normalize_phone(p_telefone);
  v_email text := lower(NULLIF(trim(coalesce(p_email,'')), ''));
  v_nome  text := NULLIF(trim(coalesce(p_nome,'')), '');
  v_clientes jsonb;
  v_purchases jsonb;
  v_payments jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF v_phone IS NULL AND v_email IS NULL AND v_nome IS NULL THEN
    RETURN jsonb_build_object('clientes','[]'::jsonb,'purchases','[]'::jsonb,'payments','[]'::jsonb);
  END IF;

  -- Matching cliente ids
  WITH matched AS (
    SELECT c.* FROM public.clientes c
    WHERE (v_phone IS NOT NULL AND public.normalize_phone(c.numero) = v_phone)
       OR (v_email IS NOT NULL AND lower(c.email) = v_email)
       OR (v_nome  IS NOT NULL AND similarity(lower(c.nome), lower(v_nome)) > 0.45)
  )
  SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at DESC) INTO v_clientes FROM matched m;

  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.data_compra DESC NULLS LAST)
  INTO v_purchases
  FROM public.client_purchases p
  WHERE p.cliente_id IN (
    SELECT id FROM public.clientes c
    WHERE (v_phone IS NOT NULL AND public.normalize_phone(c.numero) = v_phone)
       OR (v_email IS NOT NULL AND lower(c.email) = v_email)
       OR (v_nome  IS NOT NULL AND similarity(lower(c.nome), lower(v_nome)) > 0.45)
  );

  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.paid_at DESC NULLS LAST)
  INTO v_payments
  FROM public.client_payments p
  WHERE p.status = 'paid'
    AND p.cliente_id IN (
      SELECT id FROM public.clientes c
      WHERE (v_phone IS NOT NULL AND public.normalize_phone(c.numero) = v_phone)
         OR (v_email IS NOT NULL AND lower(c.email) = v_email)
         OR (v_nome  IS NOT NULL AND similarity(lower(c.nome), lower(v_nome)) > 0.45)
    );

  RETURN jsonb_build_object(
    'clientes',  coalesce(v_clientes,  '[]'::jsonb),
    'purchases', coalesce(v_purchases, '[]'::jsonb),
    'payments',  coalesce(v_payments,  '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.buscar_investimentos_cliente(text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.buscar_investimentos_cliente(text,text,text) TO authenticated;

-- Audit log table
CREATE TABLE public.extrato_investimento_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text NOT NULL,
  referencia text,
  total_unico numeric NOT NULL DEFAULT 0,
  total_mensal numeric NOT NULL DEFAULT 0,
  qtd_numeros integer NOT NULL DEFAULT 0,
  itens jsonb NOT NULL DEFAULT '{}'::jsonb,
  gerado_por uuid REFERENCES auth.users(id),
  gerado_por_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.extrato_investimento_logs TO authenticated;
GRANT ALL ON public.extrato_investimento_logs TO service_role;

ALTER TABLE public.extrato_investimento_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert extrato logs"
  ON public.extrato_investimento_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = gerado_por);

CREATE POLICY "Owners or admins can view extrato logs"
  ON public.extrato_investimento_logs FOR SELECT TO authenticated
  USING (auth.uid() = gerado_por OR public.is_admin());

CREATE INDEX idx_extrato_logs_created_at ON public.extrato_investimento_logs(created_at DESC);
CREATE INDEX idx_extrato_logs_gerado_por ON public.extrato_investimento_logs(gerado_por);
