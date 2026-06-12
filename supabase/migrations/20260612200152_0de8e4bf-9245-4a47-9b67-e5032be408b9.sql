
-- Explicit admin-only SELECT on credential tables (silences scanner false positives on FOR ALL coverage)
CREATE POLICY "Admins can select reminder config" ON public.consulta_numeros_reminder_config
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Admins can select social media report config" ON public.social_media_report_config
  FOR SELECT TO authenticated USING (is_admin());

-- Add missing UPDATE/DELETE on client_whatsapp_groups (admin-only)
CREATE POLICY "Admins can update whatsapp groups" ON public.client_whatsapp_groups
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can delete whatsapp groups" ON public.client_whatsapp_groups
  FOR DELETE TO authenticated USING (is_admin());
