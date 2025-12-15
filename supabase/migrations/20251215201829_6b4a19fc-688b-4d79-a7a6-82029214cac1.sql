-- Add billing active field to clientes table
ALTER TABLE public.clientes 
ADD COLUMN cobranca_ativa boolean NOT NULL DEFAULT true;

-- Add comment explaining the field
COMMENT ON COLUMN public.clientes.cobranca_ativa IS 'Indica se o cliente recebe cobranças automáticas mensais. False para clientes com acesso vitalício ou que não precisam de cobrança.';