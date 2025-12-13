-- Add tags column to clientes table
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create client_payments table to track Mercado Pago payments
CREATE TABLE IF NOT EXISTS public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  payment_id text NOT NULL,
  preference_id text,
  payment_type text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamp with time zone,
  billing_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_payments
CREATE POLICY "Admins can manage client_payments" ON public.client_payments
  FOR ALL USING (is_admin());

CREATE POLICY "Operadores can view client_payments" ON public.client_payments
  FOR SELECT USING (is_operador());

CREATE POLICY "Service can insert client_payments" ON public.client_payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update client_payments" ON public.client_payments
  FOR UPDATE USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_client_payments_cliente_id ON public.client_payments(cliente_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_status ON public.client_payments(status);
CREATE INDEX IF NOT EXISTS idx_clientes_tags ON public.clientes USING GIN(tags);

-- Add trigger for updated_at
CREATE TRIGGER update_client_payments_updated_at
  BEFORE UPDATE ON public.client_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();