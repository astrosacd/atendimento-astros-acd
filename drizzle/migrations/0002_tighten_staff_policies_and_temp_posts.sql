-- 1) Pin search_path
ALTER FUNCTION public.update_campanha_status() SET search_path = public;

-- 2) Staff predicate helper
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_admin() OR public.is_approved(auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- 3) Rewrite "signed-in only" / "true" policies to approved staff only
DO $$
DECLARE r record; pred text := 'public.is_staff()';
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd FROM pg_policies
    WHERE schemaname='public' AND (tablename, policyname) IN (
      ('numeros_aquecimento_status','Authenticated can view numeros_aquecimento_status'),
      ('numeros_aquecimento_modelos','Authenticated can view numeros_aquecimento_modelos'),
      ('planos_revendedor','Authenticated can view planos_revendedor'),
      ('chamados_config','Authenticated can view chamados_config'),
      ('consulta_numeros_masked_fields','Authenticated can view masked fields config'),
      ('consulta_numeros_config','Authenticated can view consulta_numeros_config'),
      ('divulgador_operation_logs','Authenticated can insert divulgador logs'),
      ('bloqueios_historico','Autenticados inserem historico'),
      ('system_permissions','Authenticated users can view system_permissions'),
      ('consulta_numeros_field_mappings','Authenticated can view consulta_numeros_field_mappings'),
      ('despesa_categorias','Autenticados veem categorias'),
      ('custom_roles','Authenticated users can view custom_roles'),
      ('numeros_aquecimento_history','Authenticated can insert numeros_aquecimento_history'),
      ('numeros_aquecimento_history','Authenticated can view numeros_aquecimento_history'),
      ('numeros_aquecimento_history','Service can insert numeros_aquecimento_history'),
      ('numeros_aquecimento_aparelhos','Autenticados veem aparelhos'),
      ('client_tasks_history','Authenticated can insert task history'),
      ('consulta_numeros_tipo','Usuarios autenticados podem ver tipos'),
      ('plano_ferramentas','Authenticated can view plano_ferramentas'),
      ('consulta_numeros_fields_cache','Authenticated users can read fields cache'),
      ('licencas_entregues','Authenticated can insert licencas_entregues'),
      ('sms_validation_result_shares','Authenticated users can create result shares'),
      ('calendar_notification_logs','Service can insert calendar notification logs'),
      ('client_server_tool_types','Authenticated users can view server tool types'),
      ('proposal_branding','Authenticated users can view branding'),
      ('consulta_numeros_auto_sync_config','Authenticated users can read auto sync config'),
      ('client_logos','Authenticated users can view client logos'),
      ('calendar_event_history','Authenticated users can create event history'),
      ('calendar_event_history','Authenticated users can view event history'),
      ('qr_scan_config','qr_scan_config_select_auth'),
      ('agency_products','Authenticated users can read agency_products'),
      ('calendar_config','Authenticated users can view calendar config'),
      ('numeros_aquecimento_alert_config','Authenticated users can view alert config'),
      ('despesas_cron_logs','Authenticated users can view cron logs'),
      ('proposal_status_notifications','Authenticated users can view status notifications config'),
      ('consulta_numeros_sync_status','Authenticated users can read sync status'),
      ('client_history','Service can insert client history'),
      ('consulta_numeros_obs_tags','Users can view obs tags'),
      ('horario_comercial','Todos autenticados podem ler horario'),
      ('consulta_numeros_obs_presets','Authenticated can read obs presets')
    )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    IF r.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', r.policyname, r.tablename, pred);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', r.policyname, r.tablename, pred);
    END IF;
  END LOOP;
END $$;

-- 4) Temp-access posts: replace header-based policies with token-checked RPCs
DROP POLICY IF EXISTS "Public guest can view posts via token" ON public.posts;
DROP POLICY IF EXISTS "Public guest can insert posts via token" ON public.posts;
DROP POLICY IF EXISTS "Public guest can view logs via token" ON public.post_logs;

CREATE OR REPLACE FUNCTION public.temp_list_posts(p_token text)
RETURNS SETOF public.posts LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_token IS NULL OR NOT public.check_temp_token_validity(p_token) THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  RETURN QUERY SELECT * FROM public.posts ORDER BY created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.temp_list_post_logs(p_token text, p_post_id uuid)
RETURNS SETOF public.post_logs LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_token IS NULL OR NOT public.check_temp_token_validity(p_token) THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  RETURN QUERY SELECT * FROM public.post_logs WHERE post_id = p_post_id ORDER BY created_at ASC;
END $$;

CREATE OR REPLACE FUNCTION public.temp_create_post(
  p_token text, p_type public.post_type, p_caption text, p_media_urls text[],
  p_status public.post_status, p_scheduled_for timestamptz)
RETURNS public.posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_row public.posts;
BEGIN
  SELECT created_by INTO v_owner FROM public.temporary_access_tokens
   WHERE token = p_token AND is_active = true AND expires_at > now()
     AND (max_uses IS NULL OR uses < max_uses);
  IF NOT FOUND OR v_owner IS NULL THEN RAISE EXCEPTION 'invalid token'; END IF;
  IF p_status NOT IN ('scheduled','publishing') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF length(coalesce(p_caption,'')) > 2200 THEN RAISE EXCEPTION 'caption too long'; END IF;
  INSERT INTO public.posts(user_id, type, caption, media_urls, status, scheduled_for)
  VALUES (v_owner, p_type, p_caption, p_media_urls, p_status, p_scheduled_for)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.temp_list_posts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.temp_list_post_logs(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.temp_create_post(text, public.post_type, text, text[], public.post_status, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.temp_list_posts(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.temp_list_post_logs(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.temp_create_post(text, public.post_type, text, text[], public.post_status, timestamptz) TO anon, authenticated;

-- 5) Public buckets: files stay reachable by public URL, but listing is no longer allowed
DROP POLICY IF EXISTS "Public can view gateway product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proposal images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view client logos" ON storage.objects;
DROP POLICY IF EXISTS "Instagram Media Public Access" ON storage.objects;