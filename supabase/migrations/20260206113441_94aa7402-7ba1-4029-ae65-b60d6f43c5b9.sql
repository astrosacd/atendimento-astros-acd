
-- Add auto-remarketing configuration columns to proposal_send_config
ALTER TABLE public.proposal_send_config
ADD COLUMN IF NOT EXISTS auto_remarketing_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_remarketing_max_days integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS auto_remarketing_channel text NOT NULL DEFAULT 'email';

-- Create table to track auto-remarketing sends (avoid duplicates)
CREATE TABLE IF NOT EXISTS public.proposal_auto_remarketing_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  channel text NOT NULL,
  day_number integer NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  email_sent boolean DEFAULT false,
  whatsapp_sent boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.proposal_auto_remarketing_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read logs
CREATE POLICY "Authenticated users can read auto remarketing logs"
ON public.proposal_auto_remarketing_logs FOR SELECT
TO authenticated
USING (true);

-- Service role / authenticated can insert
CREATE POLICY "Authenticated users can insert auto remarketing logs"
ON public.proposal_auto_remarketing_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_auto_remarketing_proposal ON public.proposal_auto_remarketing_logs(proposal_id, sent_at DESC);
