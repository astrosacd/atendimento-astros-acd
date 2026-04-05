
-- Fix 1: proposal_status_notification_logs - remove public SELECT
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'proposal_status_notification_logs'
      AND schemaname = 'public'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.proposal_status_notification_logs', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can view notification logs"
ON public.proposal_status_notification_logs
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: proposal_scheduled_sends - drop permissive UPDATE/DELETE, add ownership
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'proposal_scheduled_sends'
      AND schemaname = 'public'
      AND cmd IN ('UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.proposal_scheduled_sends', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can update own scheduled sends"
ON public.proposal_scheduled_sends
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_scheduled_sends.proposal_id
      AND p.user_id = auth.uid()
  )
  OR public.is_admin()
);

CREATE POLICY "Users can delete own scheduled sends"
ON public.proposal_scheduled_sends
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_scheduled_sends.proposal_id
      AND p.user_id = auth.uid()
  )
  OR public.is_admin()
);
