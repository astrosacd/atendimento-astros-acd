-- Add columns to chamados table
ALTER TABLE public.chamados 
ADD COLUMN is_internal BOOLEAN DEFAULT FALSE,
ADD COLUMN setor TEXT,
ADD COLUMN cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
ADD COLUMN criado_por UUID REFERENCES auth.users(id);

-- Update existing policies if necessary (the current policies already allow admins/tecnicos to view/update)
-- We might want to add a specific policy for internal tickets if we want to restrict visibility further, 
-- but for now, the existing "Tecnicos can view and update chamados" policy should cover it as it checks for admin/operador roles.

-- Create index for performance
CREATE INDEX idx_chamados_is_internal ON public.chamados(is_internal);
CREATE INDEX idx_chamados_cliente_id ON public.chamados(cliente_id);
CREATE INDEX idx_chamados_setor ON public.chamados(setor);
