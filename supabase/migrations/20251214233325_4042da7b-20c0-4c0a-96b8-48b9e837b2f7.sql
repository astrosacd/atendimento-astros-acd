-- Add phone column to profiles for WhatsApp welcome messages
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;