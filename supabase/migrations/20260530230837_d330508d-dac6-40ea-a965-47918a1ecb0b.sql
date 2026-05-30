-- First, check if the keys already exist to avoid errors (though migrations should be idempotent)
INSERT INTO public.ligacoes_ia_config (config_key, config_value)
VALUES 
  ('twilio_account_sid', ''),
  ('twilio_auth_token', ''),
  ('twilio_phone_number', ''),
  ('calling_provider', 'wavoip')
ON CONFLICT (config_key) DO NOTHING;
