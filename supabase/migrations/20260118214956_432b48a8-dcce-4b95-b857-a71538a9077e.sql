-- Criar tabela de categorias de despesas
CREATE TABLE public.despesa_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#6366f1',
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de despesas
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  categoria_id UUID REFERENCES public.despesa_categorias(id) ON DELETE SET NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  tipo TEXT NOT NULL DEFAULT 'avulsa' CHECK (tipo IN ('fixa', 'avulsa')),
  recorrencia TEXT DEFAULT 'mensal' CHECK (recorrencia IN ('mensal', 'trimestral', 'semestral', 'anual')),
  observacao TEXT,
  comprovante_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.despesa_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- Policies para categorias (todos usuários autenticados podem ver/criar/editar)
CREATE POLICY "Usuarios autenticados podem ver categorias" 
ON public.despesa_categorias FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem criar categorias" 
ON public.despesa_categorias FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem atualizar categorias" 
ON public.despesa_categorias FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem deletar categorias" 
ON public.despesa_categorias FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Policies para despesas
CREATE POLICY "Usuarios autenticados podem ver despesas" 
ON public.despesas FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem criar despesas" 
ON public.despesas FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem atualizar despesas" 
ON public.despesas FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem deletar despesas" 
ON public.despesas FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Triggers para updated_at
CREATE TRIGGER update_despesa_categorias_updated_at
BEFORE UPDATE ON public.despesa_categorias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_despesas_updated_at
BEFORE UPDATE ON public.despesas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir algumas categorias padrão
INSERT INTO public.despesa_categorias (nome, cor, descricao) VALUES
('Aluguel', '#ef4444', 'Aluguel do escritório ou espaço'),
('Internet', '#3b82f6', 'Serviços de internet e telefonia'),
('Energia', '#f59e0b', 'Conta de luz'),
('Água', '#06b6d4', 'Conta de água'),
('Marketing', '#8b5cf6', 'Gastos com publicidade e marketing'),
('Software', '#10b981', 'Assinaturas de software e ferramentas'),
('Outros', '#6b7280', 'Outras despesas diversas');