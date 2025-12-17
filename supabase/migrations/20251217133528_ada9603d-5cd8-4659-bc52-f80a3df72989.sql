ALTER TABLE public.divulgador_groups
ADD COLUMN IF NOT EXISTS announce boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS restrict boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS member_add_mode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_divulgador_groups_permissions ON public.divulgador_groups (announce, restrict, member_add_mode);

-- Ensure RLS remains enabled as-is (no policy changes here).