-- Add reCAPTCHA permission and seed default settings keys
INSERT INTO public.system_permissions (key, name, description, category)
VALUES 
  ('manage_recaptcha', 'Gerenciar reCAPTCHA', 'Permite habilitar/desabilitar e configurar credenciais do Google reCAPTCHA v2', 'admin')
ON CONFLICT (key) DO NOTHING;

-- Seed default rows in system_settings for recaptcha (values empty by default)
INSERT INTO public.system_settings (key, value)
VALUES 
  ('recaptcha_enabled', 'false'),
  ('recaptcha_site_key', ''),
  ('recaptcha_secret_key', '')
ON CONFLICT (key) DO NOTHING;

-- Public RPC to safely fetch only the public reCAPTCHA config (enabled + site_key)
-- without exposing the secret key. Used by the public Auth page (no auth required).
CREATE OR REPLACE FUNCTION public.get_recaptcha_public_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((SELECT value FROM public.system_settings WHERE key = 'recaptcha_enabled'), 'false') = 'true',
    'site_key', COALESCE((SELECT value FROM public.system_settings WHERE key = 'recaptcha_site_key'), '')
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_recaptcha_public_config() TO anon, authenticated;