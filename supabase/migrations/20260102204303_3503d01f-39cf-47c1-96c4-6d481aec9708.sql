-- Create table for client purchase history (for "registro" clients)
CREATE TABLE public.client_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  produto TEXT NOT NULL,
  descricao TEXT,
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.client_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage client_purchases"
  ON public.client_purchases
  FOR ALL
  USING (is_admin());

CREATE POLICY "Operadores can manage client_purchases"
  ON public.client_purchases
  FOR ALL
  USING (is_operador());

CREATE POLICY "Gerentes can manage their client purchases"
  ON public.client_purchases
  FOR ALL
  USING (
    is_gerente() AND (
      EXISTS (
        SELECT 1 FROM clientes c
        WHERE c.id = client_purchases.cliente_id
        AND c.created_by = auth.uid()
      )
    )
  );

-- Index for better performance
CREATE INDEX idx_client_purchases_cliente_id ON public.client_purchases(cliente_id);

-- Add comment
COMMENT ON TABLE public.client_purchases IS 'Histórico de compras para clientes registro (sem recorrência)';