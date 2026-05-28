-- Função para atualizar o status da campanha automaticamente
CREATE OR REPLACE FUNCTION public.update_campanha_status()
RETURNS TRIGGER AS $$
DECLARE
    total_calls INTEGER;
    finished_calls INTEGER;
    pending_calls INTEGER;
BEGIN
    -- Se a ligação não pertence a uma campanha, não faz nada
    IF (TG_OP = 'DELETE' AND OLD.campanha_id IS NULL) OR (TG_OP <> 'DELETE' AND NEW.campanha_id IS NULL) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    DECLARE
        target_campanha_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.campanha_id ELSE NEW.campanha_id END;
    BEGIN
        -- Conta as ligações da campanha
        SELECT COUNT(*) INTO total_calls FROM public.ligacoes_agendadas WHERE campanha_id = target_campanha_id;
        
        -- Se não há mais ligações (foram todas deletadas, o que não deve ocorrer pelo fluxo normal), podemos deixar como pendente ou lidar conforme necessário
        IF total_calls = 0 THEN
            UPDATE public.ligacoes_campanhas SET status = 'pendente' WHERE id = target_campanha_id;
            RETURN COALESCE(NEW, OLD);
        END IF;

        -- Conta ligações por estado
        SELECT COUNT(*) INTO finished_calls FROM public.ligacoes_agendadas 
        WHERE campanha_id = target_campanha_id AND status IN ('finalizada', 'falhou', 'cancelada');
        
        SELECT COUNT(*) INTO pending_calls FROM public.ligacoes_agendadas 
        WHERE campanha_id = target_campanha_id AND status IN ('pendente', 'em_andamento');

        -- Lógica de atualização do status da campanha
        IF pending_calls = 0 THEN
            UPDATE public.ligacoes_campanhas SET status = 'finalizada' WHERE id = target_campanha_id;
        ELSIF finished_calls > 0 THEN
            UPDATE public.ligacoes_campanhas SET status = 'em_andamento' WHERE id = target_campanha_id;
        ELSE
            UPDATE public.ligacoes_campanhas SET status = 'pendente' WHERE id = target_campanha_id;
        END IF;
    END;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para INSERT, UPDATE e DELETE na fila
DROP TRIGGER IF EXISTS tr_update_campanha_status ON public.ligacoes_agendadas;
CREATE TRIGGER tr_update_campanha_status
AFTER INSERT OR UPDATE OF status OR DELETE ON public.ligacoes_agendadas
FOR EACH ROW
EXECUTE FUNCTION public.update_campanha_status();

-- Sincronização inicial para campanhas existentes
UPDATE public.ligacoes_campanhas c
SET status = (
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 'pendente'
            WHEN COUNT(*) FILTER (WHERE status IN ('pendente', 'em_andamento')) = 0 THEN 'finalizada'
            WHEN COUNT(*) FILTER (WHERE status IN ('finalizada', 'falhou', 'cancelada')) > 0 THEN 'em_andamento'
            ELSE 'pendente'
        END
    FROM public.ligacoes_agendadas a 
    WHERE a.campanha_id = c.id
)
WHERE EXISTS (SELECT 1 FROM public.ligacoes_agendadas a WHERE a.campanha_id = c.id);
