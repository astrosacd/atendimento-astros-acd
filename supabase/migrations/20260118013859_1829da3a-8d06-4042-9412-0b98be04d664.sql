-- Add password_channel column to proposals table
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS password_channel TEXT DEFAULT NULL;