
-- 1) has_sms_temp_perm: set search_path
CREATE OR REPLACE FUNCTION public.has_sms_temp_perm(p_perm text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_perms text[];
BEGIN
  BEGIN
    v_token := nullif(current_setting('request.headers', true)::json->>'x-temp-access-token', '');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT permissions INTO v_perms
  FROM public.temporary_access_tokens
  WHERE token = v_token
    AND is_active = true
    AND expires_at > now()
    AND target_path = '/central-sms'
    AND (max_uses IS NULL OR uses < max_uses)
  LIMIT 1;

  RETURN v_perms IS NOT NULL AND p_perm = ANY(v_perms);
END;
$function$;

-- 2) client_server_tool_types: add ownership check on update
DROP POLICY IF EXISTS "Users can update non-system tool types" ON public.client_server_tool_types;
CREATE POLICY "Users can update non-system tool types"
ON public.client_server_tool_types
FOR UPDATE
TO authenticated
USING ((NOT is_system) AND ((created_by = auth.uid()) OR is_admin()))
WITH CHECK ((NOT is_system) AND ((created_by = auth.uid()) OR is_admin()));

-- 3) consulta_numeros_history: restrict service insert to service_role
DROP POLICY IF EXISTS "Service can insert consulta_numeros_history" ON public.consulta_numeros_history;
CREATE POLICY "Service can insert consulta_numeros_history"
ON public.consulta_numeros_history
FOR INSERT
TO service_role
WITH CHECK (true);

-- 4) divulgador_poll_results
DROP POLICY IF EXISTS "Service can insert poll results" ON public.divulgador_poll_results;
CREATE POLICY "Service can insert poll results"
ON public.divulgador_poll_results
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update poll results" ON public.divulgador_poll_results;
CREATE POLICY "Service can update poll results"
ON public.divulgador_poll_results
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 5) gateway_order_items
DROP POLICY IF EXISTS "Service can insert order items" ON public.gateway_order_items;
CREATE POLICY "Service can insert order items"
ON public.gateway_order_items
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can select order items" ON public.gateway_order_items;
CREATE POLICY "Service role can select order items"
ON public.gateway_order_items
FOR SELECT
TO service_role
USING (true);

-- 6) reports_notification_logs
DROP POLICY IF EXISTS "Service role can insert reports notification logs" ON public.reports_notification_logs;
CREATE POLICY "Service role can insert reports notification logs"
ON public.reports_notification_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 7) predefined_products: only admins can write
DROP POLICY IF EXISTS "Acesso total para administradores em produtos" ON public.predefined_products;
CREATE POLICY "Admins podem gerenciar produtos predefinidos"
ON public.predefined_products
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 8) payment-proofs storage: drop overly broad policies
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
