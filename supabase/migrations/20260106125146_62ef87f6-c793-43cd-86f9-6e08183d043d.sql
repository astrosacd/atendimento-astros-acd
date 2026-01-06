-- Create table for client recovery attempts history
CREATE TABLE public.client_recovery_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_vencimento DATE NOT NULL,
  data_envio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mensagem_enviada TEXT NOT NULL,
  canal VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  converteu BOOLEAN DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_recovery_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view recovery attempts"
ON public.client_recovery_attempts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert recovery attempts"
ON public.client_recovery_attempts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update recovery attempts"
ON public.client_recovery_attempts
FOR UPDATE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_client_recovery_attempts_updated_at
BEFORE UPDATE ON public.client_recovery_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_client_recovery_attempts_cliente_id ON public.client_recovery_attempts(cliente_id);
CREATE INDEX idx_client_recovery_attempts_data_envio ON public.client_recovery_attempts(data_envio DESC);