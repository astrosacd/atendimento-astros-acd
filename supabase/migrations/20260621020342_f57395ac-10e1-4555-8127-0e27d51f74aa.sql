
-- 1. client_logos: restrict INSERT/DELETE to privileged roles
DROP POLICY IF EXISTS "Authenticated users can manage client logos" ON public.client_logos;
DROP POLICY IF EXISTS "Authenticated users can delete client logos" ON public.client_logos;

CREATE POLICY "Privileged roles can insert client logos"
ON public.client_logos FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'operador')
  OR public.has_custom_role(auth.uid(), 'admin')
  OR public.has_custom_role(auth.uid(), 'gerente')
  OR public.has_custom_role(auth.uid(), 'operador')
);

CREATE POLICY "Privileged roles can delete client logos"
ON public.client_logos FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'operador')
  OR public.has_custom_role(auth.uid(), 'admin')
  OR public.has_custom_role(auth.uid(), 'gerente')
  OR public.has_custom_role(auth.uid(), 'operador')
);

-- 2. weekly_renewals_report_logs: restrict INSERT to service_role
DROP POLICY IF EXISTS "Service can insert weekly renewals logs" ON public.weekly_renewals_report_logs;

CREATE POLICY "Service role can insert weekly renewals logs"
ON public.weekly_renewals_report_logs FOR INSERT TO service_role
WITH CHECK (true);

-- 3. divulgador-media bucket: only admins (manage policy already exists)
DROP POLICY IF EXISTS "Authenticated users can upload divulgador media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view divulgador media" ON storage.objects;

CREATE POLICY "Divulgador users can view divulgador media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'divulgador-media'
  AND (public.is_admin() OR public.has_permission(auth.uid(), 'view_divulgador'))
);

CREATE POLICY "Divulgador managers can upload divulgador media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'divulgador-media'
  AND (
    public.is_admin()
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_permission(auth.uid(), 'manage_divulgador_messages')
  )
);

-- 4. proposal-images bucket: restrict uploads to privileged roles
DROP POLICY IF EXISTS "Authenticated users can upload proposal images" ON storage.objects;

CREATE POLICY "Privileged roles can upload proposal images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proposal-images'
  AND (
    public.is_admin()
    OR public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_custom_role(auth.uid(), 'admin')
    OR public.has_custom_role(auth.uid(), 'gerente')
    OR public.has_custom_role(auth.uid(), 'operador')
  )
);

-- 5. Realtime: scope divulgador topics by permission
DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can broadcast" ON realtime.messages;

CREATE POLICY "Realtime read scoped by topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  CASE
    WHEN realtime.topic() ILIKE '%divulgador%'
      THEN public.is_admin() OR public.has_permission(auth.uid(), 'view_divulgador')
    ELSE true
  END
);

CREATE POLICY "Realtime broadcast scoped by topic"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() ILIKE '%divulgador%'
      THEN public.is_admin() OR public.has_permission(auth.uid(), 'view_divulgador')
    ELSE true
  END
);
