import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import logoLoginAsset from '@/assets/logo-login.png.asset.json';

export default function RecuperarSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, informe seu email.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use secure edge function to verify email (no direct profile access)
      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('verify-email-for-recovery', {
        body: { email: email.trim() },
      });

      if (verifyError) {
        throw verifyError;
      }

      if (!verifyResult.found) {
        toast({
          title: 'Usuário não encontrado',
          description: 'Não existe uma conta cadastrada com este email.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (!verifyResult.canRecover) {
        toast({
          title: verifyResult.isPending ? 'Conta ainda não aprovada' : 'Conta rejeitada',
          description: verifyResult.isPending
            ? 'Sua solicitação de acesso ainda está aguardando aprovação do administrador.'
            : 'Seu acesso foi rejeitado pelo administrador. Você pode enviar uma nova solicitação na tela de cadastro.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Edge Function looks up user server-side by email — client cannot dictate destination
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { email: email.trim() },
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      toast({
        title: 'Email enviado!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível enviar o email de recuperação. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md bg-card border-border">
          <CardHeader className="text-center space-y-4">
            <img
              src={logoLoginAsset.url}
              alt="Astros Comunicação Digital"
              className="h-20 mx-auto"
            />
            <div className="flex justify-center">
              <Mail className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Email Enviado!</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enviamos um link de recuperação para <strong>{email}</strong>. 
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Não recebeu o email? Verifique sua pasta de spam ou tente novamente.
            </p>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                onClick={() => setEmailSent(false)}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Tentar novamente
              </Button>
              <Button 
                onClick={() => navigate('/auth')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Voltar ao Login
              </Button>
            </div>
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
            src={logoLoginAsset.url}
            alt="Astros Comunicação Digital"
            className="h-20 mx-auto"
          />
          <CardTitle className="text-2xl font-bold text-primary">Recuperar Senha</CardTitle>
          <CardDescription className="text-muted-foreground">
            Informe seu email para receber um link de recuperação de senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Link de Recuperação
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
                Voltar ao Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
