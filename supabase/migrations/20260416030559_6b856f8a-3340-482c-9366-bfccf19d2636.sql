
CREATE TABLE IF NOT EXISTS public.reports_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reports notification logs"
  ON public.reports_notification_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role can insert reports notification logs"
  ON public.reports_notification_logs FOR INSERT
  WITH CHECK (true);
