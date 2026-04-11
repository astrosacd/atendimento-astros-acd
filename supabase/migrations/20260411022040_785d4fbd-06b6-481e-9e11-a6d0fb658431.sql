
-- Add finalization columns to client_whatsapp_groups
ALTER TABLE public.client_whatsapp_groups
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by uuid,
  ADD COLUMN IF NOT EXISTS finalized_by_email text,
  ADD COLUMN IF NOT EXISTS finalized_by_name text,
  ADD COLUMN IF NOT EXISTS finalization_reason text,
  ADD COLUMN IF NOT EXISTS finalization_message text;

-- Config table for WhatsApp group settings
CREATE TABLE IF NOT EXISTS public.whatsapp_group_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_group_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage whatsapp group config"
  ON public.whatsapp_group_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default delay config (3 seconds between each participant removal)
INSERT INTO public.whatsapp_group_config (config_key, config_value)
VALUES ('participant_removal_delay_seconds', '3')
ON CONFLICT (config_key) DO NOTHING;
