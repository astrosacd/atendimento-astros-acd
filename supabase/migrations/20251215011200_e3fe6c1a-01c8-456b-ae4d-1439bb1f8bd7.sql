-- Allow public to update their own profile status when rejected (for appeal responses)
CREATE POLICY "Allow update via email for rejected users"
ON public.profiles
FOR UPDATE
USING (true)
WITH CHECK (approval_status = 'pending' AND user_response IS NOT NULL);