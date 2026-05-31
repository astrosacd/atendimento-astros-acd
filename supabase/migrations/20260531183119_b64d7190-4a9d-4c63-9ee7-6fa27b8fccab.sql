
-- 1. Restringir leitura de sms_validation_result_shares (remover acesso anônimo)
DROP POLICY IF EXISTS "Anyone can view valid shares" ON public.sms_validation_result_shares;
DROP POLICY IF EXISTS "Public can view valid shares" ON public.sms_validation_result_shares;
DROP POLICY IF EXISTS "Anyone can read valid shares" ON public.sms_validation_result_shares;

-- Política restrita: apenas autenticados podem ler diretamente; público usa RPC get_sms_result_share
CREATE POLICY "Authenticated can view valid sms shares"
ON public.sms_validation_result_shares
FOR SELECT
TO authenticated
USING (expires_at > now());

-- 2. Tornar acesso de operadores aos clientes colaborativo (alinhado ao client_files/client_tasks)
DROP POLICY IF EXISTS "Operadores can view their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Operadores can update their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Operadores can delete their own clientes" ON public.clientes;

CREATE POLICY "Operadores can view all clientes"
ON public.clientes FOR SELECT
USING (is_operador());

CREATE POLICY "Operadores can update all clientes"
ON public.clientes FOR UPDATE
USING (is_operador());

CREATE POLICY "Operadores can delete all clientes"
ON public.clientes FOR DELETE
USING (is_operador());

-- 3. Políticas DELETE/UPDATE para o bucket 'receipts'
CREATE POLICY "Admins or gerentes can update receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts' AND (is_admin() OR is_gerente()));

CREATE POLICY "Admins or gerentes can delete receipts"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipts' AND (is_admin() OR is_gerente()));
