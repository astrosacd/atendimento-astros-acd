
-- Add D+15 and D+30 date columns to clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS data_d_mais_15 date,
ADD COLUMN IF NOT EXISTS data_d_mais_30 date;

-- Update existing clients with calculated dates
UPDATE public.clientes 
SET 
  data_d_mais_15 = data_renovacao + INTERVAL '15 days',
  data_d_mais_30 = data_renovacao + INTERVAL '30 days'
WHERE data_d_mais_15 IS NULL OR data_d_mais_30 IS NULL;

-- Update trigger to include D+15 and D+30
CREATE OR REPLACE FUNCTION public.calculate_billing_dates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_d_menos_3 := NEW.data_renovacao - INTERVAL '3 days';
  NEW.data_d_mais_1 := NEW.data_renovacao + INTERVAL '1 day';
  NEW.data_d_mais_2 := NEW.data_renovacao + INTERVAL '2 days';
  NEW.data_d_mais_15 := NEW.data_renovacao + INTERVAL '15 days';
  NEW.data_d_mais_30 := NEW.data_renovacao + INTERVAL '30 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create billing-specific WhatsApp instances table
CREATE TABLE IF NOT EXISTS public.billing_whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  api_url text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.billing_whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- RLS policy for admins only
CREATE POLICY "Admins can manage billing whatsapp instances"
ON public.billing_whatsapp_instances
FOR ALL
USING (is_admin());

-- Add AI and new message configs
INSERT INTO public.billing_config (config_key, config_value) VALUES
('openai_api_key', ''),
('groq_api_key', ''),
('ai_provider', 'none'),
('ai_model', 'gpt-4o-mini'),
('ai_prompt_context', 'Você é um assistente de cobrança profissional e educado. Gere uma mensagem de cobrança personalizada e amigável.'),
('message_d_mais_15', 'Olá {nome}! Sua renovação do plano {plano} - {produto} está pendente há 15 dias. Valor: R$ {valor}. Entre em contato para regularizar!'),
('message_d_mais_30', 'Olá {nome}! ATENÇÃO: Sua renovação do plano {plano} - {produto} está pendente há 30 dias. Valor: R$ {valor}. Regularize para evitar o cancelamento do serviço!')
ON CONFLICT (config_key) DO NOTHING;
