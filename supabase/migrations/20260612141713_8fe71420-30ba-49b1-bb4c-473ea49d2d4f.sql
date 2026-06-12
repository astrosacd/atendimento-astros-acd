-- Auto-libera slot do aparelho quando número é marcado como Vendido
CREATE OR REPLACE FUNCTION public.auto_free_aparelho_on_vendido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_nome TEXT;
BEGIN
  IF NEW.status_id IS NOT NULL AND NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    SELECT nome INTO v_status_nome
    FROM public.numeros_aquecimento_status
    WHERE id = NEW.status_id;

    IF lower(v_status_nome) = 'vendido' THEN
      NEW.aparelho_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_free_aparelho_on_vendido ON public.numeros_aquecimento;
CREATE TRIGGER trg_auto_free_aparelho_on_vendido
BEFORE UPDATE ON public.numeros_aquecimento
FOR EACH ROW
EXECUTE FUNCTION public.auto_free_aparelho_on_vendido();

-- Também cobre INSERT direto com status Vendido (raro mas possível)
CREATE OR REPLACE FUNCTION public.auto_free_aparelho_on_vendido_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_nome TEXT;
BEGIN
  IF NEW.status_id IS NOT NULL THEN
    SELECT nome INTO v_status_nome
    FROM public.numeros_aquecimento_status
    WHERE id = NEW.status_id;

    IF lower(v_status_nome) = 'vendido' THEN
      NEW.aparelho_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_free_aparelho_on_vendido_insert ON public.numeros_aquecimento;
CREATE TRIGGER trg_auto_free_aparelho_on_vendido_insert
BEFORE INSERT ON public.numeros_aquecimento
FOR EACH ROW
EXECUTE FUNCTION public.auto_free_aparelho_on_vendido_insert();