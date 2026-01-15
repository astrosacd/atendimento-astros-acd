-- Add rejection reason column to proposals table
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;