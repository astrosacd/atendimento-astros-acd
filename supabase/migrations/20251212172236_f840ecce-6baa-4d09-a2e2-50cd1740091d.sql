
-- Add calculated date columns to clientes table
ALTER TABLE public.clientes 
ADD COLUMN data_d_menos_3 date,
ADD COLUMN data_d_mais_1 date,
ADD COLUMN data_d_mais_2 date;

-- Update existing clients with calculated dates
UPDATE public.clientes 
SET 
  data_d_menos_3 = data_renovacao - INTERVAL '3 days',
  data_d_mais_1 = data_renovacao + INTERVAL '1 day',
  data_d_mais_2 = data_renovacao + INTERVAL '2 days';

-- Create trigger to auto-calculate dates on insert/update
CREATE OR REPLACE FUNCTION public.calculate_billing_dates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_d_menos_3 := NEW.data_renovacao - INTERVAL '3 days';
  NEW.data_d_mais_1 := NEW.data_renovacao + INTERVAL '1 day';
  NEW.data_d_mais_2 := NEW.data_renovacao + INTERVAL '2 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_calculate_billing_dates
BEFORE INSERT OR UPDATE OF data_renovacao ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.calculate_billing_dates();

-- Create billing configuration table
CREATE TABLE public.billing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.billing_config ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins only
CREATE POLICY "Admins can manage billing config"
ON public.billing_config
FOR ALL
USING (is_admin());

-- Insert default configurations
INSERT INTO public.billing_config (config_key, config_value) VALUES
('cron_hour', '10'),
('cron_minute', '0'),
('billing_enabled', 'false'),
('email_enabled', 'true'),
('whatsapp_enabled', 'true'),
('message_d_menos_3', 'Olá {nome}! Lembramos que sua renovação do plano {plano} - {produto} vence em 3 dias ({data_renovacao}). Valor: R$ {valor}. Não deixe para última hora!'),
('message_d_zero', 'Olá {nome}! Hoje é o dia da renovação do seu plano {plano} - {produto}. Valor: R$ {valor}. Entre em contato para renovar!'),
('message_d_mais_1', 'Olá {nome}! Sua renovação do plano {plano} - {produto} venceu ontem. Valor: R$ {valor}. Regularize sua situação!'),
('message_d_mais_2', 'Olá {nome}! URGENTE: Sua renovação do plano {plano} - {produto} está atrasada há 2 dias. Valor: R$ {valor}. Evite a suspensão do serviço!');

-- Create billing logs table
CREATE TABLE public.billing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  cliente_nome text NOT NULL,
  cliente_email text,
  cliente_numero text,
  message_type text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.billing_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for billing logs
CREATE POLICY "Admins can view billing logs"
ON public.billing_logs
FOR SELECT
USING (is_admin());

CREATE POLICY "Service can insert billing logs"
ON public.billing_logs
FOR INSERT
WITH CHECK (true);
