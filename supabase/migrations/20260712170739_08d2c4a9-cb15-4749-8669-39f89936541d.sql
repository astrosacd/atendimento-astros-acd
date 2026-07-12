
CREATE TABLE public.instagram_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  channel TEXT,
  target TEXT,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ig_notif_logs_user_created ON public.instagram_notification_logs(user_id, created_at DESC);
CREATE INDEX idx_ig_notif_logs_event ON public.instagram_notification_logs(event_type, created_at DESC);

GRANT SELECT ON public.instagram_notification_logs TO authenticated;
GRANT ALL ON public.instagram_notification_logs TO service_role;

ALTER TABLE public.instagram_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own instagram notification logs"
  ON public.instagram_notification_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages instagram notification logs"
  ON public.instagram_notification_logs
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
