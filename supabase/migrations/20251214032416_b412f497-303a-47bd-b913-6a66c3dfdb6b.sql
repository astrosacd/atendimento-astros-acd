-- Remove the redundant policy that allows any authenticated user to potentially access profiles
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- The remaining policies are sufficient:
-- "Users can view their own profile" - USING (auth.uid() = user_id)
-- "Admins can view all profiles" - USING (is_admin())