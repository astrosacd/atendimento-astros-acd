-- Add error_message column to store error details
ALTER TABLE public.client_recovery_attempts 
ADD COLUMN IF NOT EXISTS error_message TEXT;