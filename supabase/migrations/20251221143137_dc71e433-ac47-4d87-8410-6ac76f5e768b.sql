-- Create table for multiple order bumps per order
CREATE TABLE public.gateway_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.gateway_orders(id) ON DELETE CASCADE,
  order_bump_id UUID NOT NULL REFERENCES public.gateway_order_bumps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gateway_order_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage gateway_order_items"
ON public.gateway_order_items
FOR ALL
USING (is_admin());

CREATE POLICY "Service can insert order items"
ON public.gateway_order_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can select order items"
ON public.gateway_order_items
FOR SELECT
USING (true);

-- Index for faster lookups
CREATE INDEX idx_gateway_order_items_order_id ON public.gateway_order_items(order_id);