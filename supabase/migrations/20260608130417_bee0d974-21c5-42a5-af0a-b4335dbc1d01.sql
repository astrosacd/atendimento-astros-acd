UPDATE public.divulgador_messages
SET status = 'resolved', updated_at = now()
WHERE status = 'failed'
  AND resolution = 'resolved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'divulgador_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.divulgador_messages;
  END IF;
END $$;