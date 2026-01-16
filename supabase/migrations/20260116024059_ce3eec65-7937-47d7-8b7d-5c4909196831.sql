-- Remover a política muito permissiva
DROP POLICY IF EXISTS "Public can update proposal status via share token" ON public.proposals;

-- Criar uma política mais restritiva que só permite atualizar se o status não for 'accepted' ou 'rejected'
-- E só permite atualizar os campos de assinatura/status
CREATE POLICY "Public can sign proposal via share token"
ON public.proposals
FOR UPDATE
USING (
  status NOT IN ('accepted', 'rejected')
  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
)
WITH CHECK (
  status IN ('viewed', 'accepted', 'rejected')
);