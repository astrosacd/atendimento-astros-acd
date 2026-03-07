
-- Table for agency products (product catalog for AI message generation)
CREATE TABLE public.agency_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  beneficios TEXT,
  categoria TEXT,
  preco TEXT,
  detalhes_extras TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agency_products"
  ON public.agency_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage agency_products"
  ON public.agency_products FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
