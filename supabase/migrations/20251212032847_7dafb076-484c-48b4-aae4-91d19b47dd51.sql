-- Create approval history table for audit
CREATE TABLE public.approval_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
  role_assigned TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view and insert into approval history
CREATE POLICY "Admins can view approval history" 
ON public.approval_history 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can insert approval history" 
ON public.approval_history 
FOR INSERT 
WITH CHECK (is_admin());