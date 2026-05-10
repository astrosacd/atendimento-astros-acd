DROP POLICY IF EXISTS "Users can delete own proposals" ON public.proposals;

CREATE POLICY "Users can delete own proposals"
ON public.proposals
FOR DELETE
TO authenticated
USING (
  status <> 'accepted'
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
);