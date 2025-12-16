-- Add group_id to welcome config (boas-vindas por grupo específico)
ALTER TABLE public.divulgador_welcome_config ADD COLUMN group_id UUID REFERENCES public.divulgador_groups(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX idx_divulgador_welcome_config_group_id ON public.divulgador_welcome_config(group_id);