
-- Trigger: quando um numero vira "Vendido", desconecta todos os check-ins ativos dele
-- (libera a vaga do modelo no QR Scans, igual já libera o aparelho_id).
CREATE OR REPLACE FUNCTION public.auto_desconectar_checkins_on_vendido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendido_status_id uuid;
BEGIN
  SELECT id INTO vendido_status_id
  FROM public.numeros_aquecimento_status
  WHERE LOWER(nome) = 'vendido'
  LIMIT 1;

  IF vendido_status_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status_id = vendido_status_id
     AND (TG_OP = 'INSERT' OR OLD.status_id IS DISTINCT FROM NEW.status_id) THEN
    UPDATE public.qr_scan_checkins_diarios
    SET status_conexao = 'desconectado'
    WHERE numero = NEW.numero
      AND status_conexao = 'conectado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_desconectar_checkins_on_vendido ON public.numeros_aquecimento;
CREATE TRIGGER trg_auto_desconectar_checkins_on_vendido
AFTER INSERT OR UPDATE OF status_id ON public.numeros_aquecimento
FOR EACH ROW
EXECUTE FUNCTION public.auto_desconectar_checkins_on_vendido();

-- Backfill: desconecta check-ins ativos de todos os números já Vendidos
UPDATE public.qr_scan_checkins_diarios c
SET status_conexao = 'desconectado'
WHERE c.status_conexao = 'conectado'
  AND EXISTS (
    SELECT 1
    FROM public.numeros_aquecimento n
    JOIN public.numeros_aquecimento_status s ON s.id = n.status_id
    WHERE n.numero = c.numero
      AND LOWER(s.nome) = 'vendido'
  );
