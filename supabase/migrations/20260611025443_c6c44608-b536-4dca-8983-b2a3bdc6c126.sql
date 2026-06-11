
-- automation_logs: admin only
DROP POLICY IF EXISTS "Authenticated users can read automation_logs" ON public.automation_logs;
CREATE POLICY "Admins can read automation_logs"
  ON public.automation_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- client_pipeline: admin only
DROP POLICY IF EXISTS "Authenticated users can manage client_pipeline" ON public.client_pipeline;
DROP POLICY IF EXISTS "Authenticated users can read client_pipeline" ON public.client_pipeline;
CREATE POLICY "Admins can manage client_pipeline"
  ON public.client_pipeline FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- followup_config: admin only for SELECT
DROP POLICY IF EXISTS "Authenticated users can view followup config" ON public.followup_config;
CREATE POLICY "Admins can view followup config"
  ON public.followup_config FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- gateway_settings: explicit admin-only SELECT (defense in depth)
CREATE POLICY "Admins can select gateway_settings"
  ON public.gateway_settings FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- proposal_views: scoped to proposal owner or admin
DROP POLICY IF EXISTS "Authenticated users can view proposal views" ON public.proposal_views;
CREATE POLICY "Owners and admins can view proposal views"
  ON public.proposal_views FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_views.proposal_id
        AND p.user_id = auth.uid()
    )
  );

-- system_activities: own rows + admin
DROP POLICY IF EXISTS "Authenticated users can view system activities" ON public.system_activities;
CREATE POLICY "Users can view own activities or admins all"
  ON public.system_activities FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.billing_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.client_scores;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_security_alerts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.system_activities;
