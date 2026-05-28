
-- 1) licencas_entregues: restrict insert to authenticated only
DROP POLICY IF EXISTS "Service can insert licencas_entregues" ON public.licencas_entregues;
CREATE POLICY "Authenticated can insert licencas_entregues"
ON public.licencas_entregues
FOR INSERT
TO authenticated
WITH CHECK (true);
CREATE POLICY "Service role can insert licencas_entregues"
ON public.licencas_entregues
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2) gateway_coupons: restrict update to admin or service_role
DROP POLICY IF EXISTS "Service can update coupons" ON public.gateway_coupons;
CREATE POLICY "Admins can update coupons"
ON public.gateway_coupons
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
CREATE POLICY "Service role can update coupons"
ON public.gateway_coupons
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 3) social_credential_share_links: scope to owner + admin
DROP POLICY IF EXISTS "Authenticated users can manage share links" ON public.social_credential_share_links;
CREATE POLICY "Owners can manage their share links"
ON public.social_credential_share_links
FOR ALL
TO authenticated
USING (auth.uid() = created_by OR public.is_admin())
WITH CHECK (auth.uid() = created_by OR public.is_admin());

-- 4) ligacoes_ia_config: temp tokens must not read secret entries
DROP POLICY IF EXISTS "Temp access can view ligacoes_ia_config" ON public.ligacoes_ia_config;
CREATE POLICY "Temp access can view non-secret ligacoes_ia_config"
ON public.ligacoes_ia_config
FOR SELECT
USING (
  is_secret = false
  AND public.has_ligacoes_temp_perm('view_ligacoes_ia')
);
