CREATE OR REPLACE FUNCTION public.update_campanha_status()
RETURNS TRIGGER AS $$
DECLARE
    total_calls INTEGER;
    finished_calls INTEGER;
    in_progress_calls INTEGER;
    pending_only_calls INTEGER;
    target_campanha_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_campanha_id := OLD.campanha_id;
    ELSE
        target_campanha_id := NEW.campanha_id;
    END IF;

    IF target_campanha_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Conta as ligações da campanha
    SELECT COUNT(*) INTO total_calls FROM public.ligacoes_agendadas WHERE campanha_id = target_campanha_id;
    
    IF total_calls = 0 THEN
        UPDATE public.ligacoes_campanhas SET status = 'pendente' WHERE id = target_campanha_id;
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Conta ligações por estados específicos
    SELECT COUNT(*) INTO finished_calls FROM public.ligacoes_agendadas 
    WHERE campanha_id = target_campanha_id AND status IN ('finalizada', 'falhou', 'cancelada');
    
    SELECT COUNT(*) INTO in_progress_calls FROM public.ligacoes_agendadas 
    WHERE campanha_id = target_campanha_id AND status = 'em_andamento';

    SELECT COUNT(*) INTO pending_only_calls FROM public.ligacoes_agendadas 
    WHERE campanha_id = target_campanha_id AND status = 'pendente';

    -- Lógica de atualização
    IF finished_calls = total_calls THEN
        UPDATE public.ligacoes_campanhas SET status = 'finalizada' WHERE id = target_campanha_id;
    ELSIF in_progress_calls > 0 OR finished_calls > 0 THEN
        UPDATE public.ligacoes_campanhas SET status = 'em_andamento' WHERE id = target_campanha_id;
    ELSE
        UPDATE public.ligacoes_campanhas SET status = 'pendente' WHERE id = target_campanha_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronização inicial para campanhas existentes com a nova lógica
UPDATE public.ligacoes_campanhas c
SET status = (
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 'pendente'
            WHEN COUNT(*) = COUNT(*) FILTER (WHERE status IN ('finalizada', 'falhou', 'cancelada')) THEN 'finalizada'
            WHEN COUNT(*) FILTER (WHERE status = 'em_andamento') > 0 OR COUNT(*) FILTER (WHERE status IN ('finalizada', 'falhou', 'cancelada')) > 0 THEN 'em_andamento'
            ELSE 'pendente'
        END
    FROM public.ligacoes_agendadas a 
    WHERE a.campanha_id = c.id
)
WHERE EXISTS (SELECT 1 FROM public.ligacoes_agendadas a WHERE a.campanha_id = c.id);
