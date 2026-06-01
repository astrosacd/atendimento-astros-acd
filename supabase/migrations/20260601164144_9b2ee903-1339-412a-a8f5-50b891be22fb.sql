-- Criar função para registrar SMS na timeline
CREATE OR REPLACE FUNCTION public.handle_sms_history_timeline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cliente_id IS NOT NULL THEN
        INSERT INTO public.client_history (
            cliente_id,
            campo,
            valor_antigo,
            valor_novo,
            criado_por
        ) VALUES (
            NEW.cliente_id,
            'SMS Enviado',
            NULL,
            SUBSTR(NEW.conteudo, 1, 200),
            NULL -- Sistema
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para sms_history
DROP TRIGGER IF EXISTS on_sms_sent_timeline ON public.sms_history;
CREATE TRIGGER on_sms_sent_timeline
AFTER INSERT ON public.sms_history
FOR EACH ROW
EXECUTE FUNCTION public.handle_sms_history_timeline();

-- Garantir GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_history TO authenticated;
GRANT ALL ON public.client_history TO service_role;
