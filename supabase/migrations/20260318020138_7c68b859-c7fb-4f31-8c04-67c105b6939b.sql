
ALTER TABLE public.billing_logs ADD COLUMN IF NOT EXISTS resolution text DEFAULT NULL;
ALTER TABLE public.billing_logs ADD COLUMN IF NOT EXISTS resolution_note text DEFAULT NULL;
ALTER TABLE public.billing_logs ADD COLUMN IF NOT EXISTS resolved_at timestamptz DEFAULT NULL;
ALTER TABLE public.billing_logs ADD COLUMN IF NOT EXISTS resolved_by text DEFAULT NULL;
