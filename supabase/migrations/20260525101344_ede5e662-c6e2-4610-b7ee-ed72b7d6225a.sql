
-- ===== Chamados & related: remove anonymous INSERT/UPDATE (service_role bypasses RLS) =====
DROP POLICY IF EXISTS "Service can insert chamados" ON public.chamados;
DROP POLICY IF EXISTS "Service can update chamados" ON public.chamados;
DROP POLICY IF EXISTS "Service can insert comentarios" ON public.chamados_comentarios;
DROP POLICY IF EXISTS "Service can insert chamados_historico" ON public.chamados_historico;
DROP POLICY IF EXISTS "Service can insert webhook_logs" ON public.chamados_webhook_logs;
DROP POLICY IF EXISTS "System can insert auto-reply history" ON public.ig_auto_reply_history;
DROP POLICY IF EXISTS "Service can insert notification logs" ON public.proposal_status_notification_logs;
DROP POLICY IF EXISTS "Service can insert proposal webhook logs" ON public.proposal_webhook_logs;
DROP POLICY IF EXISTS "System can insert tts logs" ON public.proposal_tts_logs;

-- Re-add restricted insert policies for authenticated users only (service_role still bypasses RLS)
CREATE POLICY "Authenticated users can insert tts logs"
  ON public.proposal_tts_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ===== Lead Hunter config tables: admin only =====
DROP POLICY IF EXISTS "Authenticated users can manage config" ON public.lead_hunter_config;
CREATE POLICY "Admins can manage lead hunter config"
  ON public.lead_hunter_config FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can manage whatsapp instances" ON public.lead_hunter_whatsapp_instances;
CREATE POLICY "Admins can manage lead hunter whatsapp instances"
  ON public.lead_hunter_whatsapp_instances FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated users can manage baserow config" ON public.lead_hunter_baserow_config;
CREATE POLICY "Admins can manage lead hunter baserow config"
  ON public.lead_hunter_baserow_config FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ===== Calendar notification whatsapp instances: admins only for SELECT too =====
DROP POLICY IF EXISTS "Authenticated users can view calendar notification whatsapp ins" ON public.calendar_notification_whatsapp_instances;

-- ===== shared_access_tokens: lock SELECT, expose validation via RPC =====
DROP POLICY IF EXISTS "Public can read tokens by value" ON public.shared_access_tokens;
CREATE POLICY "Authenticated users can read tokens"
  ON public.shared_access_tokens FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.validate_shared_access_token(p_token text)
RETURNS TABLE(valid boolean, target_url text, expires_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (s.expires_at > now()) as valid,
    s.target_url,
    s.expires_at
  FROM public.shared_access_tokens s
  WHERE s.token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_shared_access_token(text) TO anon, authenticated;

-- ===== Realtime: restrict subscriptions to authenticated users =====
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can use realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can broadcast"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (true);
