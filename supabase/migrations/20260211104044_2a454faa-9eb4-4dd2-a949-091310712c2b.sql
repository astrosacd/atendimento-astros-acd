
-- Fix 1: proposal_status_notifications - restrict from public to authenticated only
DROP POLICY IF EXISTS "Authenticated users can view status notifications config" ON public.proposal_status_notifications;
DROP POLICY IF EXISTS "Authenticated users can insert status notifications config" ON public.proposal_status_notifications;
DROP POLICY IF EXISTS "Authenticated users can update status notifications config" ON public.proposal_status_notifications;

CREATE POLICY "Authenticated users can view status notifications config"
ON public.proposal_status_notifications
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert status notifications config"
ON public.proposal_status_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update status notifications config"
ON public.proposal_status_notifications
FOR UPDATE
TO authenticated
USING (true);

-- Fix 2: profiles - add RESTRICTIVE policy to block anon access
CREATE POLICY "Block anon access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);
