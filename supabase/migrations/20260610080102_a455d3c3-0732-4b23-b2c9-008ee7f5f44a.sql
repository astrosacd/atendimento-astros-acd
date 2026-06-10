
-- atomicat_submissions: block anon writes/reads explicitly
CREATE POLICY "block_anon_atomicat_submissions" ON public.atomicat_submissions
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- gateway_orders: block anon explicitly
CREATE POLICY "block_anon_gateway_orders" ON public.gateway_orders
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- divulgador_participants: block anon explicitly
CREATE POLICY "block_anon_divulgador_participants" ON public.divulgador_participants
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- sms_history: allow service_role inserts for automated/cron sends
CREATE POLICY "service_role_insert_sms_history" ON public.sms_history
  FOR INSERT TO service_role WITH CHECK (true);
