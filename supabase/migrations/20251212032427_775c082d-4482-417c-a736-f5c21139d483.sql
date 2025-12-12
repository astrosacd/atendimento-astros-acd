-- Drop the restrictive update policy and create a new one that allows admins
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new policy that allows users to update their own profile OR admins to update any profile
CREATE POLICY "Users can update own profile or admins can update any" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id OR is_admin());

-- Also add policy for admins to update via WITH CHECK
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());