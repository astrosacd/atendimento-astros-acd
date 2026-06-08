ALTER TABLE public.divulgador_messages ADD COLUMN resolution TEXT;
GRANT SELECT, UPDATE ON public.divulgador_messages TO authenticated;
GRANT ALL ON public.divulgador_messages TO service_role;