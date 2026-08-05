-- 1. chamados_comentarios: private comments admin-only
DROP POLICY IF EXISTS "Tecnicos can view comentarios" ON public.chamados_comentarios;
CREATE POLICY "Tecnicos can view comentarios"
ON public.chamados_comentarios
FOR SELECT
USING (
  public.is_admin()
  OR (
    coalesce(tipo, 'publico') <> 'privado'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role::text = 'operador'
    )
  )
);

-- 2. role_permissions: only own role visible
DROP POLICY IF EXISTS "Authenticated users can view role_permissions" ON public.role_permissions;
CREATE POLICY "Users can view own role permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text = role_permissions.role_name
  )
  OR public.has_custom_role(auth.uid(), role_permissions.role_name)
);

-- 3. client-files: operadores restricted to existing cliente folders
DROP POLICY IF EXISTS "Operadores can view client files" ON storage.objects;
CREATE POLICY "Operadores can view client files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-files' AND public.is_operador()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id::text = (storage.foldername(name))[1])
);

DROP POLICY IF EXISTS "Operadores can upload client files" ON storage.objects;
CREATE POLICY "Operadores can upload client files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-files' AND public.is_operador()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id::text = (storage.foldername(name))[1])
);

DROP POLICY IF EXISTS "Operadores can update client files" ON storage.objects;
CREATE POLICY "Operadores can update client files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-files' AND public.is_operador()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id::text = (storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'client-files' AND public.is_operador()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id::text = (storage.foldername(name))[1])
);

DROP POLICY IF EXISTS "Operadores can delete client files" ON storage.objects;
CREATE POLICY "Operadores can delete client files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-files' AND public.is_operador()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id::text = (storage.foldername(name))[1])
);

-- 4. contratos: staff-only
DROP POLICY IF EXISTS "Authenticated can read contratos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload contratos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update contratos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete contratos" ON storage.objects;

CREATE POLICY "Staff can read contratos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contratos' AND (public.is_admin() OR public.is_gerente() OR public.is_operador()));

CREATE POLICY "Staff can upload contratos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos' AND (public.is_admin() OR public.is_gerente() OR public.is_operador()));

CREATE POLICY "Staff can update contratos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contratos' AND (public.is_admin() OR public.is_gerente() OR public.is_operador()))
WITH CHECK (bucket_id = 'contratos' AND (public.is_admin() OR public.is_gerente() OR public.is_operador()));

CREATE POLICY "Staff can delete contratos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contratos' AND (public.is_admin() OR public.is_gerente()));

-- 5. social-media-reports: admin-only read
DROP POLICY IF EXISTS "Authenticated can read social reports" ON storage.objects;
CREATE POLICY "Admins can read social reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'social-media-reports' AND public.is_admin());