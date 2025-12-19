-- Create table for masked fields configuration
CREATE TABLE public.consulta_numeros_masked_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL,
  is_masked boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(field_name)
);

-- Enable RLS
ALTER TABLE public.consulta_numeros_masked_fields ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage masked fields config"
ON public.consulta_numeros_masked_fields
FOR ALL
USING (is_admin());

CREATE POLICY "Authenticated can view masked fields config"
ON public.consulta_numeros_masked_fields
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default masked fields
INSERT INTO public.consulta_numeros_masked_fields (field_name, is_masked) VALUES
('email', true),
('Email', true),
('data_cadastro', true),
('Data de Cadastro', true),
('numero_de_compra', true),
('Numero de Compra', true);

-- Add permission for viewing unmasked data
INSERT INTO public.system_permissions (key, name, description, category)
VALUES ('view_unmasked_consulta_numeros', 'Ver dados sem máscara', 'Permite visualizar dados sensíveis sem mascaramento na Consulta de Números', 'consulta_numeros')
ON CONFLICT (key) DO NOTHING;