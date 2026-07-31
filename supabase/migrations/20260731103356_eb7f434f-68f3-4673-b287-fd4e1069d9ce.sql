-- 1) Profiles: block privilege escalation explicitly
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() AND auth.role() <> 'service_role' THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.approved       IS DISTINCT FROM OLD.approved
       OR NEW.is_blocked     IS DISTINCT FROM OLD.is_blocked
       OR NEW.blocked_reason IS DISTINCT FROM OLD.blocked_reason
       OR NEW.blocked_by     IS DISTINCT FROM OLD.blocked_by
       OR NEW.blocked_at     IS DISTINCT FROM OLD.blocked_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Not allowed to modify approval or blocking fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Defense in depth at the policy level
CREATE OR REPLACE FUNCTION public.profile_admin_fields_unchanged(_user_id uuid, _approved boolean, _approval_status text, _is_blocked boolean, _blocked_reason text, _blocked_by uuid, _blocked_at timestamptz, _rejection_reason text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.approved IS NOT DISTINCT FROM _approved
      AND p.approval_status IS NOT DISTINCT FROM _approval_status
      AND p.is_blocked IS NOT DISTINCT FROM _is_blocked
      AND p.blocked_reason IS NOT DISTINCT FROM _blocked_reason
      AND p.blocked_by IS NOT DISTINCT FROM _blocked_by
      AND p.blocked_at IS NOT DISTINCT FROM _blocked_at
      AND p.rejection_reason IS NOT DISTINCT FROM _rejection_reason
  );
$function$;

DROP POLICY IF EXISTS "Users can update safe profile fields" ON public.profiles;
CREATE POLICY "Users can update safe profile fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((auth.uid() = user_id) AND (NOT public.is_admin()))
WITH CHECK (
  auth.uid() = user_id
  AND public.profile_admin_fields_unchanged(user_id, approved, approval_status, is_blocked, blocked_reason, blocked_by, blocked_at, rejection_reason)
);

-- 2) consulta_numeros_history: restrict reads to permitted users
DROP POLICY IF EXISTS "Authenticated can view consulta_numeros_history" ON public.consulta_numeros_history;
CREATE POLICY "Permitted users can view consulta_numeros_history"
ON public.consulta_numeros_history
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.has_permission(auth.uid(), 'view_history_consulta_numeros')
  OR public.has_permission(auth.uid(), 'view_consulta_numeros')
);