-- Tabela para armazenar gastos de marketing
CREATE TABLE public.marketing_expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    ano INTEGER NOT NULL,
    valor NUMERIC(15,2) NOT NULL DEFAULT 0,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(mes, ano)
);

-- Habilitar RLS
ALTER TABLE public.marketing_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Admin/Autenticado)
CREATE POLICY "Permitir leitura para usuários autenticados" 
ON public.marketing_expenses FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserção para usuários autenticados" 
ON public.marketing_expenses FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir atualização para usuários autenticados" 
ON public.marketing_expenses FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Permitir exclusão para usuários autenticados" 
ON public.marketing_expenses FOR DELETE 
TO authenticated 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_marketing_expenses_updated_at
BEFORE UPDATE ON public.marketing_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();