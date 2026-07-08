
-- 1. client_ai_logs: require user_id = auth.uid() (no NULL)
DROP POLICY IF EXISTS "Users can insert AI logs" ON public.client_ai_logs;
CREATE POLICY "Users can insert AI logs"
  ON public.client_ai_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. bloqueios: restrict SELECT to approved authenticated users only
DROP POLICY IF EXISTS "Todos autenticados podem ler bloqueios" ON public.bloqueios;
CREATE POLICY "Approved users can read bloqueios"
  ON public.bloqueios
  FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- 3. predefined_products: restrict SELECT to approved authenticated users
DROP POLICY IF EXISTS "Leitura pública para produtos predefinidos" ON public.predefined_products;
CREATE POLICY "Approved users can read predefined products"
  ON public.predefined_products
  FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- 4. gateway_orders: prevent approvers from mutating customer PII via trigger.
CREATE OR REPLACE FUNCTION public.prevent_gateway_order_pii_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and service_role bypass
  IF public.is_admin() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_cpf   IS DISTINCT FROM OLD.customer_cpf
  OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
  OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
  OR NEW.customer_name  IS DISTINCT FROM OLD.customer_name THEN
    RAISE EXCEPTION 'Customer PII fields cannot be modified through the approval workflow';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gateway_orders_prevent_pii_change ON public.gateway_orders;
CREATE TRIGGER gateway_orders_prevent_pii_change
  BEFORE UPDATE ON public.gateway_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_gateway_order_pii_change();
