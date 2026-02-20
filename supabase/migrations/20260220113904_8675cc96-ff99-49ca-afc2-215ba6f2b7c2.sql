
-- Tabela de webhooks para recuperação de clientes
CREATE TABLE public.client_recovery_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  eventos TEXT[] NOT NULL DEFAULT ARRAY['recovery.inadimplente', 'recovery.registro'],
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de webhook de recuperação
CREATE TABLE public.client_recovery_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.client_recovery_webhooks(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.client_recovery_attempts(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.client_recovery_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_recovery_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage recovery webhooks"
  ON public.client_recovery_webhooks FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view recovery webhook logs"
  ON public.client_recovery_webhook_logs FOR ALL
  USING (auth.role() = 'authenticated');

-- Trigger de updated_at
CREATE TRIGGER update_client_recovery_webhooks_updated_at
  BEFORE UPDATE ON public.client_recovery_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
