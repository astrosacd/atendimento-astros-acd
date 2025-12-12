-- Add notification settings to recovery_config
-- This will store email notification settings for API errors

-- Ensure the recovery_config table has the necessary entries
INSERT INTO public.recovery_config (config_key, config_value)
VALUES 
  ('notify_api_errors', 'false'),
  ('notification_email', '')
ON CONFLICT (config_key) DO NOTHING;