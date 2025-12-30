-- Add receipt_number column to client_payments table
ALTER TABLE public.client_payments
ADD COLUMN receipt_number text;