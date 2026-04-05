
-- Fix: Remove public SELECT policy on proposal_scheduled_sends and restrict to authenticated owners
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'proposal_scheduled_sends'
      AND schemaname = 'public'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.proposal_scheduled_sends', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can view own scheduled sends"
ON public.proposal_scheduled_sends
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_scheduled_sends.proposal_id
      AND p.user_id = auth.uid()
  )
  OR public.is_admin()
);
