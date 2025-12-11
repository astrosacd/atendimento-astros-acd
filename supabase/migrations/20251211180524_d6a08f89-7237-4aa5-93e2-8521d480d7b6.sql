-- Add approved column to profiles table
ALTER TABLE public.profiles ADD COLUMN approved boolean NOT NULL DEFAULT false;

-- Update RLS policy for profiles to allow only approved users to access the system
-- First, create a function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND approved = true
  )
$$;

-- Insert the first admin user directly (we'll update this after signup)
-- For now, let's just ensure existing users are approved
UPDATE public.profiles SET approved = true WHERE user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
);