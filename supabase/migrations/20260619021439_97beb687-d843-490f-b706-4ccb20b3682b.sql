
-- 1) Sensitive credentials tables: add RESTRICTIVE policy to block non-admin authenticated reads/writes
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'api_keys','baserow_integrations','chamados_api_keys','consulta_numeros_api_keys',
    'numeros_aquecimento_api_keys','billing_whatsapp_instances',
    'calendar_notification_whatsapp_instances','divulgador_whatsapp_instance',
    'lead_hunter_whatsapp_instances','whatsapp_instances'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Only admins can access %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Only admins can access %I" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t, t);
  END LOOP;
END $$;

-- 2) calendar_events: owner or admin
DROP POLICY IF EXISTS "Authenticated users can view calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Authenticated users can create calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Authenticated users can update calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Authenticated users can delete calendar events" ON public.calendar_events;
CREATE POLICY "Owners or admins can view calendar events" ON public.calendar_events FOR SELECT TO authenticated USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Owners can create calendar events" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners or admins can update calendar events" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_admin()) WITH CHECK (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Owners or admins can delete calendar events" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_admin());

-- 3) client_followups: owner or admin
DROP POLICY IF EXISTS "Authenticated users can view followups" ON public.client_followups;
DROP POLICY IF EXISTS "Authenticated users can update followups" ON public.client_followups;
DROP POLICY IF EXISTS "Authenticated users can delete followups" ON public.client_followups;
CREATE POLICY "Owners or admins can view followups" ON public.client_followups FOR SELECT TO authenticated USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Owners or admins can update followups" ON public.client_followups FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_admin()) WITH CHECK (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Owners or admins can delete followups" ON public.client_followups FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_admin());

-- 4) client_followup_logs: admin only read
DROP POLICY IF EXISTS "Authenticated users can view followup logs" ON public.client_followup_logs;
CREATE POLICY "Admins can view followup logs" ON public.client_followup_logs FOR SELECT TO authenticated USING (public.is_admin());

-- 5) client_pipeline: admin only
DROP POLICY IF EXISTS "Authenticated users can view client_pipeline" ON public.client_pipeline;
CREATE POLICY "Admins can view client_pipeline" ON public.client_pipeline FOR SELECT TO authenticated USING (public.is_admin());

-- 6) client_recovery_attempts: admin only
DROP POLICY IF EXISTS "Authenticated users can view recovery attempts" ON public.client_recovery_attempts;
DROP POLICY IF EXISTS "Authenticated users can insert recovery attempts" ON public.client_recovery_attempts;
CREATE POLICY "Admins can view recovery attempts" ON public.client_recovery_attempts FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert recovery attempts" ON public.client_recovery_attempts FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 7) client_recovery_webhook_logs: admin only
DROP POLICY IF EXISTS "Authenticated users can view recovery webhook logs" ON public.client_recovery_webhook_logs;
CREATE POLICY "Admins can manage recovery webhook logs" ON public.client_recovery_webhook_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8) client_whatsapp_groups: owner or admin
DROP POLICY IF EXISTS "Authenticated users can view groups" ON public.client_whatsapp_groups;
DROP POLICY IF EXISTS "Authenticated users can insert groups" ON public.client_whatsapp_groups;
CREATE POLICY "Owners or admins can view groups" ON public.client_whatsapp_groups FOR SELECT TO authenticated USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Owners can insert groups" ON public.client_whatsapp_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- 9) payment_links: owner or admin
DROP POLICY IF EXISTS "Authenticated users can view payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Authenticated users can update payment links" ON public.payment_links;
CREATE POLICY "Owners or admins can view payment links" ON public.payment_links FOR SELECT TO authenticated USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Owners or admins can update payment links" ON public.payment_links FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_admin()) WITH CHECK (auth.uid() = created_by OR public.is_admin());

-- 10) payment_link_share_tokens: owner or admin
DROP POLICY IF EXISTS "Authenticated users can view share tokens" ON public.payment_link_share_tokens;
CREATE POLICY "Owners or admins can view share tokens" ON public.payment_link_share_tokens FOR SELECT TO authenticated USING (auth.uid() = created_by OR public.is_admin());

-- 11) qr_scan_monthly_counter: admin only writes; admin only read
DROP POLICY IF EXISTS "qr_scan_monthly_counter_modify_auth" ON public.qr_scan_monthly_counter;
DROP POLICY IF EXISTS "qr_scan_monthly_counter_select_auth" ON public.qr_scan_monthly_counter;
CREATE POLICY "Admins can manage qr_scan_monthly_counter" ON public.qr_scan_monthly_counter FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 12) automation_rules: admin only read (admin already has ALL)
DROP POLICY IF EXISTS "Authenticated users can read automation_rules" ON public.automation_rules;

-- 13) client_ai_upsell_suggestions: admin only
DROP POLICY IF EXISTS "Users can view suggestions" ON public.client_ai_upsell_suggestions;
DROP POLICY IF EXISTS "Users can insert/update suggestions" ON public.client_ai_upsell_suggestions;
CREATE POLICY "Admins can manage upsell suggestions" ON public.client_ai_upsell_suggestions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 14) despesas_cron_config: admin only
DROP POLICY IF EXISTS "Authenticated users can view cron config" ON public.despesas_cron_config;
DROP POLICY IF EXISTS "Authenticated users can update cron config" ON public.despesas_cron_config;
CREATE POLICY "Admins can view despesas cron config" ON public.despesas_cron_config FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update despesas cron config" ON public.despesas_cron_config FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 15) followup_webhook_logs: admin only
DROP POLICY IF EXISTS "Authenticated users can view followup webhook logs" ON public.followup_webhook_logs;
CREATE POLICY "Admins can view followup webhook logs" ON public.followup_webhook_logs FOR SELECT TO authenticated USING (public.is_admin());

-- 16) proposal_auto_remarketing_logs: admin only
DROP POLICY IF EXISTS "Authenticated users can read auto remarketing logs" ON public.proposal_auto_remarketing_logs;
DROP POLICY IF EXISTS "Authenticated users can insert auto remarketing logs" ON public.proposal_auto_remarketing_logs;
CREATE POLICY "Admins can read auto remarketing logs" ON public.proposal_auto_remarketing_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert auto remarketing logs" ON public.proposal_auto_remarketing_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 17) proposal_branding: admin write, authenticated read OK (branding shown in UI). Keep SELECT to authenticated, restrict writes.
DROP POLICY IF EXISTS "Authenticated users can insert branding" ON public.proposal_branding;
DROP POLICY IF EXISTS "Authenticated users can update branding" ON public.proposal_branding;
CREATE POLICY "Admins can insert branding" ON public.proposal_branding FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update branding" ON public.proposal_branding FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 18) proposal_status_notification_logs: admin only
DROP POLICY IF EXISTS "Authenticated users can view notification logs" ON public.proposal_status_notification_logs;
CREATE POLICY "Admins can view proposal notification logs" ON public.proposal_status_notification_logs FOR SELECT TO authenticated USING (public.is_admin());

-- 19) proposal_status_notifications: admin write
DROP POLICY IF EXISTS "Authenticated users can insert status notifications config" ON public.proposal_status_notifications;
DROP POLICY IF EXISTS "Authenticated users can update status notifications config" ON public.proposal_status_notifications;
CREATE POLICY "Admins can insert proposal status notifications" ON public.proposal_status_notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update proposal status notifications" ON public.proposal_status_notifications FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 20) proposal_webhook_logs: admin only
DROP POLICY IF EXISTS "Authenticated users can view proposal webhook logs" ON public.proposal_webhook_logs;
CREATE POLICY "Admins can view proposal webhook logs" ON public.proposal_webhook_logs FOR SELECT TO authenticated USING (public.is_admin());

-- 21) reports_analysis_history: admin only
DROP POLICY IF EXISTS "Authenticated users can view analysis history" ON public.reports_analysis_history;
DROP POLICY IF EXISTS "Authenticated users can insert analysis history" ON public.reports_analysis_history;
CREATE POLICY "Admins can view reports analysis history" ON public.reports_analysis_history FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert reports analysis history" ON public.reports_analysis_history FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 22) reports_notification_logs: admin only
DROP POLICY IF EXISTS "Authenticated users can view reports notification logs" ON public.reports_notification_logs;
CREATE POLICY "Admins can view reports notification logs" ON public.reports_notification_logs FOR SELECT TO authenticated USING (public.is_admin());

-- 23) sms_validation_share_tokens: owner only (or admin)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sms_validation_share_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sms_validation_share_tokens', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Owners or admins can view sms share tokens" ON public.sms_validation_share_tokens FOR SELECT TO authenticated USING (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Users can create their sms share tokens" ON public.sms_validation_share_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners or admins can update sms share tokens" ON public.sms_validation_share_tokens FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_admin()) WITH CHECK (auth.uid() = created_by OR public.is_admin());
CREATE POLICY "Owners or admins can delete sms share tokens" ON public.sms_validation_share_tokens FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.is_admin());

-- 24) whatsapp_group_config: admin only
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_group_config'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.whatsapp_group_config', r.policyname);
  END LOOP;
END $$;
CREATE POLICY "Admins can manage whatsapp_group_config" ON public.whatsapp_group_config FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
