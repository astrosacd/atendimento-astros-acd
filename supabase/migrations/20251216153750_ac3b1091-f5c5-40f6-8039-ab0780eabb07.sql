-- Adicionar constraint unique para upsert de participantes
ALTER TABLE public.divulgador_participants 
ADD CONSTRAINT divulgador_participants_group_number_unique 
UNIQUE (group_id, whatsapp_number);

-- Função para incrementar contagem de participantes
CREATE OR REPLACE FUNCTION public.increment_participant_count(p_group_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE divulgador_groups 
  SET participant_count = participant_count + 1 
  WHERE id = p_group_id;
END;
$$;