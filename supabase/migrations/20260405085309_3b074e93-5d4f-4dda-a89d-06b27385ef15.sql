
-- Fix 1: gateway_order_items - restrict SELECT to service_role only
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'gateway_order_items'
      AND schemaname = 'public'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.gateway_order_items', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Service role can select order items"
ON public.gateway_order_items
FOR SELECT
TO service_role
USING (true);

-- Also allow admins to view order items
CREATE POLICY "Admins can select order items"
ON public.gateway_order_items
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Fix 2: proposals - remove the dangerous public UPDATE policy
-- All proposal signing goes through sign_proposal() RPC which validates share_token
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'proposals'
      AND schemaname = 'public'
      AND cmd = 'UPDATE'
      AND roles::text LIKE '%public%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.proposals', pol.policyname);
  END LOOP;
END $$;
