
-- Add conversion tracking fields to client_followups
ALTER TABLE public.client_followups 
ADD COLUMN IF NOT EXISTS conversion_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS conversion_note text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS converted_at timestamptz DEFAULT NULL;

-- Add check constraint for valid values
ALTER TABLE public.client_followups 
ADD CONSTRAINT client_followups_conversion_status_check 
CHECK (conversion_status IS NULL OR conversion_status IN ('converted', 'not_converted'));
