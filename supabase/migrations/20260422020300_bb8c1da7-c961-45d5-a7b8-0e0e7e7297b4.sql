-- 1) Restrict system_activities SELECT to authenticated users (was readable by anon)
DROP POLICY IF EXISTS "Users can view system activities" ON public.system_activities;

CREATE POLICY "Authenticated users can view system activities"
ON public.system_activities
FOR SELECT
TO authenticated
USING (true);

-- 2) Pin search_path on the 3 remaining functions flagged by the linter
ALTER FUNCTION public.can_approve_order(user_uuid uuid) SET search_path = public;
ALTER FUNCTION public.has_custom_role(user_uuid uuid, role_name text) SET search_path = public;
ALTER FUNCTION public.check_duplicate_pix_transaction() SET search_path = public;