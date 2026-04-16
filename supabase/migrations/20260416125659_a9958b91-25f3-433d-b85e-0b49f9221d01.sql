-- Habilita pg_net se ainda não estiver habilitado
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agenda a sincronização a cada 5 minutos
SELECT cron.schedule(
  'chatwoot-sync-job',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/chatwoot-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM"}'::jsonb
    );
  $$
);