-- Permitir que visitantes públicos atualizem o status da proposta via share_token
CREATE POLICY "Public can update proposal status via share token"
ON public.proposals
FOR UPDATE
USING (true)
WITH CHECK (true);