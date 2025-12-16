-- Enable realtime for divulgador tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.divulgador_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.divulgador_groups;