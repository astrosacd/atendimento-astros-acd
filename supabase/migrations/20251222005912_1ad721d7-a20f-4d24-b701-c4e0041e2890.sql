-- Add poll support columns to divulgador_messages table
ALTER TABLE public.divulgador_messages 
ADD COLUMN IF NOT EXISTS poll_options text[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS poll_selectable_count integer DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN public.divulgador_messages.poll_options IS 'Array of poll options for poll media type';
COMMENT ON COLUMN public.divulgador_messages.poll_selectable_count IS 'Number of options user can select in poll (1 = single choice)';