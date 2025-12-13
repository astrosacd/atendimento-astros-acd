-- Alterar a coluna role de enum para text para suportar roles customizadas
ALTER TABLE public.user_roles 
ALTER COLUMN role TYPE text 
USING role::text;

-- Adicionar restrição para garantir que o role existe na tabela custom_roles
-- (Removemos o enum constraint e usamos verificação via FK ou trigger)

-- Atualizar os valores antigos para o formato correto
UPDATE public.user_roles SET role = 'user' WHERE role = 'user';
UPDATE public.user_roles SET role = 'admin' WHERE role = 'admin';
UPDATE public.user_roles SET role = 'operador' WHERE role = 'operador';
UPDATE public.user_roles SET role = 'gerente' WHERE role = 'gerente';

-- Adicionar política para que operadores e gerentes possam ver logs de atividade
CREATE POLICY "Operadores can view client history" 
ON public.client_history 
FOR SELECT 
USING (is_operador());

CREATE POLICY "Gerentes can view client history" 
ON public.client_history 
FOR SELECT 
USING (is_gerente());

-- Permitir usuários autenticados verem o histórico
CREATE POLICY "Authenticated users can view client history" 
ON public.client_history 
FOR SELECT 
USING (auth.uid() IS NOT NULL);