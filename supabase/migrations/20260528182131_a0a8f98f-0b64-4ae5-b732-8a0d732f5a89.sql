-- 1) Fix has_custom_role: add fixed search_path
CREATE OR REPLACE FUNCTION public.has_custom_role(user_uuid uuid, role_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.custom_roles cr ON ur.role = cr.name
    WHERE ur.user_id = user_uuid AND cr.name = role_name
  );
END;
$function$;

-- 2) Restrict divulgador-media DELETE to admins only
DROP POLICY IF EXISTS "Authenticated users can delete divulgador media" ON storage.objects;

CREATE POLICY "Admins can delete divulgador media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'divulgador-media' AND public.is_admin());

-- 3) Restrict social-media-reports bucket read to authenticated users
DROP POLICY IF EXISTS "Public read social reports" ON storage.objects;

CREATE POLICY "Authenticated can read social reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'social-media-reports');