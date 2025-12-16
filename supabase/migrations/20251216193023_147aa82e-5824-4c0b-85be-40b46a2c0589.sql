ALTER TABLE public.divulgador_messages ADD COLUMN IF NOT EXISTS group_id uuid NULL;
ALTER TABLE public.divulgador_messages
  ADD CONSTRAINT divulgador_messages_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.divulgador_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_divulgador_messages_group_id ON public.divulgador_messages(group_id);