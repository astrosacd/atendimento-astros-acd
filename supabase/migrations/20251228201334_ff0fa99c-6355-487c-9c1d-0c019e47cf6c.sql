-- Allow admins to delete client history
CREATE POLICY "Admins can delete client history"
ON public.client_history
FOR DELETE
USING (is_admin());