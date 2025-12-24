-- Adicionar campo de moeda na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN moeda text NOT NULL DEFAULT 'BRL';

-- Adicionar constraint para garantir valores válidos
ALTER TABLE public.clientes 
ADD CONSTRAINT clientes_moeda_check CHECK (moeda IN ('BRL', 'USD'));