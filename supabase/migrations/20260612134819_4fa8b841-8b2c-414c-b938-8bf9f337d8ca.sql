-- Trigger: impedir delete de aparelho que ainda tenha número vinculado
CREATE OR REPLACE FUNCTION public.prevent_delete_aparelho_with_numeros()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.numeros_aquecimento
  WHERE aparelho_id = OLD.id;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir este aparelho: existem % número(s) vinculado(s). Mova ou exclua os números antes (ver aba "Números Órfãos").', v_count
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_aparelho_with_numeros ON public.numeros_aquecimento_aparelhos;

CREATE TRIGGER trg_prevent_delete_aparelho_with_numeros
BEFORE DELETE ON public.numeros_aquecimento_aparelhos
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_aparelho_with_numeros();