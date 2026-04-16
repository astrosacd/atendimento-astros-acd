ALTER TABLE public.reports_analysis_config 
ADD COLUMN IF NOT EXISTS gmail_user TEXT,
ADD COLUMN IF NOT EXISTS gmail_app_password TEXT,
ADD COLUMN IF NOT EXISTS gmail_sender_name TEXT;