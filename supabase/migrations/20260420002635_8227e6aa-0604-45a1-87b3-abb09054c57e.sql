-- Alterar a tabela clientes para tornar email e cpf opcionais
ALTER TABLE public.clientes ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.clientes ALTER COLUMN cpf DROP NOT NULL;
