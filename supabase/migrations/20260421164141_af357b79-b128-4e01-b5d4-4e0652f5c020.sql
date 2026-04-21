ALTER TABLE public.client_payments
ADD COLUMN IF NOT EXISTS submitted_by uuid,
ADD COLUMN IF NOT EXISTS submitted_by_email text,
ADD COLUMN IF NOT EXISTS submitted_by_name text;