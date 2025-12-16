-- Add instance_id to groups to support multiple WhatsApp instances
ALTER TABLE public.divulgador_groups
ADD COLUMN IF NOT EXISTS instance_id uuid;

-- Optional FK (keeps data consistent, but allows null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'divulgador_groups_instance_id_fkey'
  ) THEN
    ALTER TABLE public.divulgador_groups
    ADD CONSTRAINT divulgador_groups_instance_id_fkey
    FOREIGN KEY (instance_id) REFERENCES public.divulgador_instances(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_divulgador_groups_instance_id ON public.divulgador_groups(instance_id);
CREATE INDEX IF NOT EXISTS idx_divulgador_groups_whatsapp_group_id ON public.divulgador_groups(whatsapp_group_id);

-- Ensure RLS remains enabled
ALTER TABLE public.divulgador_groups ENABLE ROW LEVEL SECURITY;