-- Add column to track if instance is admin of the group
ALTER TABLE public.divulgador_groups 
ADD COLUMN IF NOT EXISTS is_instance_admin boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.divulgador_groups.is_instance_admin IS 'Indicates if the WhatsApp instance number is an admin of this group';