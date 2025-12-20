-- Add coupon compatibility flag to order bumps
ALTER TABLE public.gateway_order_bumps
ADD COLUMN IF NOT EXISTS allow_coupon boolean NOT NULL DEFAULT true;

-- Backfill safety (no-op if default already applied)
UPDATE public.gateway_order_bumps SET allow_coupon = true WHERE allow_coupon IS NULL;