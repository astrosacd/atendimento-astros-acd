-- Add billing cycle field to clientes table
ALTER TABLE public.clientes 
ADD COLUMN ciclo_cobranca text NOT NULL DEFAULT 'mensal';

-- Add a comment to document the valid values
COMMENT ON COLUMN public.clientes.ciclo_cobranca IS 'Billing cycle: mensal, trimestral, semestral, anual';