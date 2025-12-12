-- Create client history table to track all changes
CREATE TABLE public.client_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted'
  changed_by UUID,
  changed_by_email TEXT,
  previous_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all history
CREATE POLICY "Admins can view client history" 
ON public.client_history 
FOR SELECT 
USING (is_admin());

-- Service role can insert history
CREATE POLICY "Service can insert client history" 
ON public.client_history 
FOR INSERT 
WITH CHECK (true);

-- Authenticated users can insert history
CREATE POLICY "Authenticated users can insert history" 
ON public.client_history 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_client_history_cliente_id ON public.client_history(cliente_id);
CREATE INDEX idx_client_history_created_at ON public.client_history(created_at DESC);