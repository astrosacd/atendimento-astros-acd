-- Add explicit restrictive policies to prevent modifications to audit logs
-- This ensures audit trail integrity by preventing any DELETE or UPDATE operations

-- Prevent all deletes on audit logs (ensures audit records cannot be removed)
CREATE POLICY "No one can delete audit logs"
ON public.audit_logs FOR DELETE
USING (false);

-- Prevent all updates on audit logs (ensures audit records cannot be modified)
CREATE POLICY "No one can update audit logs"
ON public.audit_logs FOR UPDATE
USING (false);