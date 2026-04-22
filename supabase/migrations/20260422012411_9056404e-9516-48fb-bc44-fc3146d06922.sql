-- Adiciona as colunas para classificação profissional e controle de métricas
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'cliente';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS excluir_metricas BOOLEAN DEFAULT false;

-- Atualiza o cliente Baby Born especificamente conforme solicitado pelo usuário
UPDATE public.clientes 
SET tipo = 'administrativo', excluir_metricas = true 
WHERE nome ILIKE '%Baby Born%';

-- Comentário para futuras referências:
-- Tipos sugeridos: 'cliente', 'administrativo', 'parceiro', 'agencia'