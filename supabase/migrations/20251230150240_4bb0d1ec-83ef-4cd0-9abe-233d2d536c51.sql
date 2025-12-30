-- Add language preference column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'pt-BR';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.language IS 'User preferred language: pt-BR, en, es';