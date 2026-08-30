ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;

-- Backfill: usa a marcação mais recente de cancelamento no histórico
UPDATE public.clientes c
SET cancelado_em = sub.ultima
FROM (
  SELECT ch.cliente_id, MAX(ch.created_at) AS ultima
  FROM public.client_history ch
  WHERE ch.action ILIKE '%cancel%' OR ch.new_data::text ILIKE '%cancelado%'
  GROUP BY ch.cliente_id
) sub
WHERE c.id = sub.cliente_id
  AND c.cobranca_ativa = false
  AND c.tags::text ILIKE '%cancelado%';

-- Fallback: cancelados sem histórico usam o updated_at
UPDATE public.clientes
SET cancelado_em = updated_at
WHERE cobranca_ativa = false
  AND tags::text ILIKE '%cancelado%'
  AND cancelado_em IS NULL;

-- Função + trigger: mantém cancelado_em automaticamente em qualquer fluxo
CREATE OR REPLACE FUNCTION public.handle_cliente_cancelado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  had_tag boolean := COALESCE(OLD.tags::text ILIKE '%"cancelado"%', false);
  has_tag boolean := COALESCE(NEW.tags::text ILIKE '%"cancelado"%', false);
BEGIN
  IF has_tag AND NOT had_tag THEN
    NEW.cancelado_em := now();
  ELSIF NOT has_tag AND had_tag THEN
    NEW.cancelado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_cancelado_em ON public.clientes;
CREATE TRIGGER trg_cliente_cancelado_em
BEFORE UPDATE OF tags ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.handle_cliente_cancelado_em();