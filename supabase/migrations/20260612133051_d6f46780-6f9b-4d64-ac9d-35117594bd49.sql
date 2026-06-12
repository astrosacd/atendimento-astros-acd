
-- 1. Helper: has_permission (admin sempre true)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_name = ur.role
      WHERE ur.user_id = _user_id
        AND rp.permission_key = _permission_key
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

-- 2. followup_webhooks: remover SELECT amplo
DROP POLICY IF EXISTS "Authenticated users can view followup webhooks" ON public.followup_webhooks;

-- 3. sms_validation_result_shares: SELECT só admin ou criador
DROP POLICY IF EXISTS "Authenticated can view valid sms shares" ON public.sms_validation_result_shares;
CREATE POLICY "Admin or creator can view sms shares"
  ON public.sms_validation_result_shares
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR created_by = auth.uid());

-- 4. gateway_coupons: remover SELECT amplo
DROP POLICY IF EXISTS "Authenticated users can view active coupons" ON public.gateway_coupons;

-- 5. client_pipeline: SELECT pra todos autenticados
CREATE POLICY "Authenticated users can view client_pipeline"
  ON public.client_pipeline
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 6. MCP config / tools / meta_template_mapping: só admin
DROP POLICY IF EXISTS "Allow all access to authenticated users for mcp_config" ON public.mcp_config;
CREATE POLICY "Admins manage mcp_config"
  ON public.mcp_config FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow all access to authenticated users for mcp_tools" ON public.mcp_tools;
CREATE POLICY "Admins manage mcp_tools"
  ON public.mcp_tools FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Allow all authenticated users on meta_template_mapping" ON public.meta_template_mapping;
CREATE POLICY "Admins manage meta_template_mapping"
  ON public.meta_template_mapping FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. Divulgador: SELECT para quem tem view_divulgador
CREATE POLICY "Users with view_divulgador can read groups"
  ON public.divulgador_groups FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'view_divulgador'));

CREATE POLICY "Users with view_divulgador can read participants"
  ON public.divulgador_participants FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'view_divulgador'));

CREATE POLICY "Users with view_divulgador can read messages"
  ON public.divulgador_messages FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'view_divulgador'));

CREATE POLICY "Users with view_divulgador can read campaigns"
  ON public.divulgador_campaigns FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'view_divulgador'));

CREATE POLICY "Users with view_divulgador can read send_logs"
  ON public.divulgador_send_logs FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'view_divulgador'));

CREATE POLICY "Users with view_divulgador can read poll_results"
  ON public.divulgador_poll_results FOR SELECT
  TO authenticated
  USING (public.has_permission(auth.uid(), 'view_divulgador'));
