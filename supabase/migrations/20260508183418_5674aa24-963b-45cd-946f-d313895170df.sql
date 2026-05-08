-- Tabela de Status das Integrações
CREATE TABLE public.integration_status (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    integration_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'whatsapp', 'crm', 'ai', 'payments', etc.
    status TEXT NOT NULL DEFAULT 'online', -- 'online', 'offline', 'warning'
    last_check TIMESTAMP WITH TIME ZONE DEFAULT now(),
    error_message TEXT,
    response_time_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Logs de Integração
CREATE TABLE public.integration_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    integration_name TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Cotas de API
CREATE TABLE public.api_quotas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    api_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    limit_type TEXT NOT NULL, -- 'requests', 'credits', 'percentage'
    current_value NUMERIC NOT NULL DEFAULT 0,
    max_value NUMERIC,
    alert_threshold NUMERIC DEFAULT 20, -- Alerta quando restar 20%
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.integration_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_quotas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Apenas Admins)
-- Nota: Assumindo que o sistema já tem uma forma de identificar admins via metadados de auth ou uma tabela de perfis.
-- Se não houver, criaremos uma política básica que pode ser refinada.

CREATE POLICY "Admins can view integration status" 
ON public.integration_status FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can manage integration status" 
ON public.integration_status FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can view integration logs" 
ON public.integration_logs FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Admins can view api quotas" 
ON public.api_quotas FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role' OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
));

-- Triggers para updated_at
CREATE TRIGGER update_integration_status_updated_at
BEFORE UPDATE ON public.integration_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_quotas_updated_at
BEFORE UPDATE ON public.api_quotas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados iniciais para as principais integrações
INSERT INTO public.integration_status (integration_name, display_name, category, status)
VALUES 
    ('meta_whatsapp', 'WhatsApp Business API (Meta)', 'whatsapp', 'online'),
    ('evolution_api', 'Evolution API', 'whatsapp', 'online'),
    ('google_calendar', 'Google Calendar', 'google', 'online'),
    ('mercadopago', 'Mercado Pago', 'payments', 'online'),
    ('stripe', 'Stripe', 'payments', 'online'),
    ('serper_api', 'Serper API (Busca)', 'ai', 'online'),
    ('manychat', 'ManyChat', 'crm', 'online'),
    ('gmail', 'Gmail Integration', 'google', 'online');

INSERT INTO public.api_quotas (api_name, display_name, limit_type, current_value, max_value)
VALUES 
    ('serper_api', 'Serper API Credits', 'credits', 0, 1000),
    ('meta_whatsapp', 'Monthly WhatsApp Messages', 'requests', 0, 10000);
