
-- Tabela de propostas agendadas para envio
CREATE TABLE public.proposal_scheduled_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL DEFAULT 'both' CHECK (channel IN ('email', 'whatsapp', 'both')),
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  enable_password_protection BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error', 'cancelled')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_scheduled_sends ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view scheduled sends" ON public.proposal_scheduled_sends
  FOR SELECT USING (true);

CREATE POLICY "Users can create scheduled sends" ON public.proposal_scheduled_sends
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update scheduled sends" ON public.proposal_scheduled_sends
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete scheduled sends" ON public.proposal_scheduled_sends
  FOR DELETE USING (true);

-- Index for cron job queries
CREATE INDEX idx_proposal_scheduled_sends_pending ON public.proposal_scheduled_sends(status, scheduled_at) WHERE status = 'pending';
