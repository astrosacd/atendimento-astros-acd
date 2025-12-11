-- Add approval status and rejection fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS user_response TEXT;

-- Update existing approved users
UPDATE public.profiles SET approval_status = 'approved' WHERE approved = true;
UPDATE public.profiles SET approval_status = 'pending' WHERE approved = false;