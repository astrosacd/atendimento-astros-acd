-- Add delay_seconds column to divulgador_messages
ALTER TABLE public.divulgador_messages 
ADD COLUMN IF NOT EXISTS delay_seconds integer DEFAULT 2;