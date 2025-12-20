-- Create gateway events table for conversion tracking
CREATE TABLE IF NOT EXISTS public.gateway_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  slug TEXT NULL,
  product_id UUID NULL,
  order_id UUID NULL,
  order_bump_id UUID NULL,
  coupon_code TEXT NULL,
  currency TEXT NULL,
  payment_gateway TEXT NULL,
  metadata JSONB NULL,
  user_agent TEXT NULL,
  referrer TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_gateway_events_created_at ON public.gateway_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_events_event_type ON public.gateway_events (event_type);
CREATE INDEX IF NOT EXISTS idx_gateway_events_slug ON public.gateway_events (slug);

ALTER TABLE public.gateway_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read analytics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='gateway_events' AND policyname='Admins can view gateway events'
  ) THEN
    CREATE POLICY "Admins can view gateway events"
    ON public.gateway_events
    FOR SELECT
    USING (is_admin());
  END IF;
END$$;

-- Block direct writes from clients (events should be inserted via backend function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='gateway_events' AND policyname='No direct inserts for gateway events'
  ) THEN
    CREATE POLICY "No direct inserts for gateway events"
    ON public.gateway_events
    FOR INSERT
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='gateway_events' AND policyname='No updates for gateway events'
  ) THEN
    CREATE POLICY "No updates for gateway events"
    ON public.gateway_events
    FOR UPDATE
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='gateway_events' AND policyname='No deletes for gateway events'
  ) THEN
    CREATE POLICY "No deletes for gateway events"
    ON public.gateway_events
    FOR DELETE
    USING (false);
  END IF;
END$$;