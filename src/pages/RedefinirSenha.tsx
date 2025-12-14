import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, Loader2, Lock } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z
  .object({
    password: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem.',
    path: ['confirmPassword'],
  });

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Erro de validação',
        description: validation.error.errors[0]?.message || 'Verifique os dados informados.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast({
        title: 'Senha redefinida!',
        description: 'Sua senha foi atualizada com sucesso. Use a nova senha para acessar o sistema.',
      });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: 'Erro ao redefinir senha',
        description:
          'O link de recuperação pode ter expirado ou é inválido. Solicite uma nova recuperação de senha.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center space-y-4">
            <img
              src="https://i.imgur.com/odbwwWW.png"
              alt="Astros Comunicação Digital"
              className="h-20 mx-auto"
            />
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Senha atualizada!</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sua nova senha já está valendo. Por segurança, faça login novamente utilizando a nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/auth');
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
            >
              Ir para a tela de login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center space-y-4">
          <img
            src="https://i.imgur.com/odbwwWW.png"
            alt="Astros Comunicação Digital"
            className="h-20 mx-auto"
          />
          <CardTitle className="text-2xl font-bold text-primary">Redefinir Senha</CardTitle>
          <CardDescription className="text-muted-foreground">
            Defina uma nova senha de acesso para a sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Nova senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input border-border text-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirmar nova senha
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-input border-border text-foreground"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Atualizando senha...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Redefinir senha
                </>
              )}
            </Button>
            <div className="text-center pt-2">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/auth')}
                className="text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar ao login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
