ALTER TABLE public.instagram_settings 
ADD COLUMN IF NOT EXISTS manager_numbers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS renewal_webhook_url TEXT,
ADD COLUMN IF NOT EXISTS last_renewal_notification_at TIMESTAMP WITH TIME ZONE;

-- Add evolution_config fields if they don't exist in settings (shared config)
-- Using billing_config is better for evolution api URL/Key to avoid repetition
