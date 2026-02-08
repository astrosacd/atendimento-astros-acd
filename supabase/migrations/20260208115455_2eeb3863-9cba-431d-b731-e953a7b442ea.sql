-- Config table for proposal status notifications (accept/reject)
CREATE TABLE IF NOT EXISTS public.proposal_status_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  -- Accept notification
  accept_enabled BOOLEAN DEFAULT true,
  accept_channel TEXT DEFAULT 'whatsapp' CHECK (accept_channel IN ('email', 'whatsapp', 'both')),
  accept_message_template TEXT DEFAULT 'Olá {nome}! 🎉 Sua proposta "{titulo}" foi aceita com sucesso! O próximo passo é formalizar o contrato. Entraremos em contato em breve!',
  -- Reject notification  
  reject_enabled BOOLEAN DEFAULT true,
  reject_channel TEXT DEFAULT 'whatsapp' CHECK (reject_channel IN ('email', 'whatsapp', 'both')),
  reject_message_template TEXT DEFAULT 'Olá {nome}, vi que a proposta "{titulo}" foi recusada. Posso ajudar com alguma dúvida ou ajustar algo? Estamos à disposição!',
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_status_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view status notifications config"
  ON public.proposal_status_notifications FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert status notifications config"
  ON public.proposal_status_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update status notifications config"
  ON public.proposal_status_notifications FOR UPDATE USING (true);

-- Logs table
CREATE TABLE IF NOT EXISTS public.proposal_status_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  status_change TEXT NOT NULL, -- 'accepted' or 'rejected'
  channel TEXT NOT NULL,
  recipient TEXT,
  message_sent TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposal_status_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view notification logs"
  ON public.proposal_status_notification_logs FOR SELECT USING (true);

CREATE POLICY "Service can insert notification logs"
  ON public.proposal_status_notification_logs FOR INSERT WITH CHECK (true);

CREATE INDEX idx_proposal_status_notif_logs_proposal ON public.proposal_status_notification_logs(proposal_id);

-- Trigger function: notify edge function on accept/reject
CREATE OR REPLACE FUNCTION public.notify_proposal_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_config RECORD;
  v_url TEXT;
BEGIN
  -- Only fire when status changes TO accepted or rejected
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status NOT IN ('accepted', 'rejected') THEN
    RETURN NEW;
  END IF;
  
  -- Check if notifications are enabled
  SELECT * INTO v_config FROM public.proposal_status_notifications LIMIT 1;
  
  IF v_config IS NULL OR NOT v_config.enabled THEN
    RETURN NEW;
  END IF;
  
  -- Call edge function via pg_net
  v_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/proposal-status-notify';
  
  IF v_url IS NULL OR v_url = '/functions/v1/proposal-status-notify' THEN
    -- Fallback: use direct URL
    v_url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/proposal-status-notify';
  END IF;
  
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    ),
    body := jsonb_build_object(
      'proposal_id', NEW.id,
      'new_status', NEW.status,
      'old_status', OLD.status,
      'signed_name', NEW.signed_name,
      'rejection_reason', NEW.rejection_reason
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on proposals table
DROP TRIGGER IF EXISTS trigger_proposal_status_notify ON public.proposals;
CREATE TRIGGER trigger_proposal_status_notify
  AFTER UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_proposal_status_change();

-- Insert default config
INSERT INTO public.proposal_status_notifications (enabled)
VALUES (false)
ON CONFLICT DO NOTHING;