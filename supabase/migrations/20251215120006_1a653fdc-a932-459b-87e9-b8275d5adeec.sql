-- Criar política para permitir busca de perfil por email na recuperação de senha
-- Esta política permite que usuários não autenticados verifiquem se um email existe
CREATE POLICY "Allow email lookup for password recovery" 
ON public.profiles 
FOR SELECT 
USING (true);