
-- Add manager notification numbers to proposal_status_notifications
ALTER TABLE public.proposal_status_notifications
ADD COLUMN IF NOT EXISTS manager_numbers text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS manager_accept_message text DEFAULT 'A proposta "{titulo}" foi ACEITA pelo cliente {nome}. Entre em contato imediatamente!',
ADD COLUMN IF NOT EXISTS manager_reject_message text DEFAULT 'A proposta "{titulo}" foi RECUSADA pelo cliente {nome}. Motivo: {motivo}. Faça o follow-up!',
ADD COLUMN IF NOT EXISTS manager_notify_enabled boolean DEFAULT false;

-- Create proposal webhooks table
CREATE TABLE public.proposal_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_key TEXT,
  eventos TEXT[] DEFAULT '{proposta.visualizada,proposta.aceita,proposta.recusada}',
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposal_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage proposal webhooks"
ON public.proposal_webhooks FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create proposal webhook logs table
CREATE TABLE public.proposal_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID REFERENCES public.proposal_webhooks(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposal_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view proposal webhook logs"
ON public.proposal_webhook_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service can insert proposal webhook logs"
ON public.proposal_webhook_logs FOR INSERT
WITH CHECK (true);
