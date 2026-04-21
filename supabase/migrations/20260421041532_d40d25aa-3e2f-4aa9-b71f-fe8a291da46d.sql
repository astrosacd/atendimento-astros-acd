
ALTER TABLE public.client_payments 
  ADD COLUMN IF NOT EXISTS pix_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS ocr_status TEXT,
  ADD COLUMN IF NOT EXISTS ocr_amount NUMERIC;

CREATE INDEX IF NOT EXISTS idx_client_payments_pix_tx_id 
  ON public.client_payments(pix_transaction_id) 
  WHERE pix_transaction_id IS NOT NULL;

INSERT INTO public.billing_config (config_key, config_value)
VALUES ('pixpague_config', '{"ocr_enabled":true,"duplicate_check":true,"whatsapp_notifications":false,"approver_phones":"","ai_provider":"gemini"}')
ON CONFLICT (config_key) DO NOTHING;
