
-- Fix billing_logs: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service can insert billing logs" ON public.billing_logs;
CREATE POLICY "Service can insert billing logs"
ON public.billing_logs FOR INSERT TO service_role
WITH CHECK (true);

-- Fix client_payments: restrict INSERT and UPDATE to service_role only
DROP POLICY IF EXISTS "Service can insert client_payments" ON public.client_payments;
CREATE POLICY "Service can insert client_payments"
ON public.client_payments FOR INSERT TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update client_payments" ON public.client_payments;
CREATE POLICY "Service can update client_payments"
ON public.client_payments FOR UPDATE TO service_role
USING (true);
