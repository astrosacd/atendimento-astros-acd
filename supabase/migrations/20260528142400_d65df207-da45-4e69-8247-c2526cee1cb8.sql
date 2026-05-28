CREATE POLICY "Users with manage_ligacoes_campanhas can manage"
ON public.ligacoes_campanhas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'manage_ligacoes_campanhas'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'manage_ligacoes_campanhas'
  )
);

CREATE POLICY "Users with manage_ligacoes_campanhas can manage agendadas"
ON public.ligacoes_agendadas
FOR ALL
TO authenticated
USING (
  campanha_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'manage_ligacoes_campanhas'
  )
)
WITH CHECK (
  campanha_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_name = ur.role
    WHERE ur.user_id = auth.uid()
      AND rp.permission_key = 'manage_ligacoes_campanhas'
  )
);