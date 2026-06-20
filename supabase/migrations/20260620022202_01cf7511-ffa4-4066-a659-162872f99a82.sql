
-- automation_logs: somente admin pode inserir
DROP POLICY IF EXISTS "Admins can insert automation_logs" ON public.automation_logs;
CREATE POLICY "Admins can insert automation_logs"
  ON public.automation_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- client_score_history: somente admin pode inserir manualmente (triggers SECURITY DEFINER continuam funcionando)
DROP POLICY IF EXISTS "System can insert history" ON public.client_score_history;
CREATE POLICY "Admins can insert score history"
  ON public.client_score_history FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- client_scores: somente admin pode inserir manualmente
DROP POLICY IF EXISTS "System can insert scores" ON public.client_scores;
CREATE POLICY "Admins can insert scores"
  ON public.client_scores FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- consulta_numeros_reminder_logs: somente admin pode inserir (edge functions usam service_role)
DROP POLICY IF EXISTS "Service can insert reminder logs" ON public.consulta_numeros_reminder_logs;
CREATE POLICY "Admins can insert reminder logs"
  ON public.consulta_numeros_reminder_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Storage: company_assets bucket -- só admin faz upload
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
CREATE POLICY "Admins upload company_assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company_assets' AND public.is_admin());

CREATE POLICY "Admins update company_assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company_assets' AND public.is_admin());

CREATE POLICY "Admins delete company_assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company_assets' AND public.is_admin());

-- Storage: proposal-images bucket -- UPDATE/DELETE só admin
DROP POLICY IF EXISTS "Authenticated users can update proposal images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete proposal images" ON storage.objects;

CREATE POLICY "Admins update proposal images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'proposal-images' AND public.is_admin());

CREATE POLICY "Admins delete proposal images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proposal-images' AND public.is_admin());
