DROP POLICY IF EXISTS "Authenticated can read whitelisted settings" ON public.system_settings;
CREATE POLICY "Authenticated can read whitelisted settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (key = ANY (ARRAY['recaptcha_site_key','recaptcha_enabled','app_name','app_logo_url','app_theme','horario_supabase_url','horario_supabase_anon_key']));