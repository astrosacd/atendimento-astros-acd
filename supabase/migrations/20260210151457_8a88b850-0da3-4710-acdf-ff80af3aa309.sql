
-- Add cron hour to proposal_send_config (default 9 = 09:00 BRT = 12:00 UTC)
ALTER TABLE public.proposal_send_config
ADD COLUMN IF NOT EXISTS auto_remarketing_cron_hour integer NOT NULL DEFAULT 9;

-- Add delay between manager notifications (in seconds, default 5)
ALTER TABLE public.proposal_status_notifications
ADD COLUMN IF NOT EXISTS manager_delay_seconds integer NOT NULL DEFAULT 5;
