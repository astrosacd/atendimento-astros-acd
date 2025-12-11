import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Clock, XCircle, Send } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

interface ProfileStatus {
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  user_response: string | null;
}

export default function Auth() {
  const navigate = useNavigate();
  const { user, isApproved, signIn, signUp, signOut, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [userResponse, setUserResponse] = useState('');
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (authLoading) return;
    
    if (user && isApproved) {
      navigate('/');
    } else if (user && !isApproved) {
      // Fetch detailed profile status
      fetchProfileStatus();
    }
  }, [user, isApproved, authLoading, navigate]);

  const fetchProfileStatus = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('approval_status, rejection_reason, user_response')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setProfileStatus(data as ProfileStatus);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      toast({
        title: 'Erro de validação',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsLoading(false);

    if (error) {
      let message = 'Erro ao fazer login';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email ou senha incorretos';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Por favor, confirme seu email';
      }
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = signupSchema.safeParse(signupData);
    if (!result.success) {
      toast({
        title: 'Erro de validação',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupData.email, signupData.password, signupData.name);
    setIsLoading(false);

    if (error) {
      let message = 'Erro ao criar conta';
      if (error.message.includes('already registered')) {
        message = 'Este email já está cadastrado';
      }
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Solicitação enviada!',
        description: 'Aguarde a aprovação de um administrador.',
      });
      setProfileStatus({ approval_status: 'pending', rejection_reason: null, user_response: null });
    }
  };

  const handleSendResponse = async () => {
    if (!user || !userResponse.trim()) return;

    setIsSendingResponse(true);
    const { error } = await supabase
      .from('profiles')
      .update({ user_response: userResponse, approval_status: 'pending' })
      .eq('user_id', user.id);

    setIsSendingResponse(false);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar sua resposta.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Resposta enviada!',
        description: 'Sua resposta foi enviada para análise.',
      });
      setProfileStatus(prev => prev ? { ...prev, user_response: userResponse, approval_status: 'pending' } : null);
      setUserResponse('');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  // Show status screens for logged-in users awaiting approval
  if (user && profileStatus) {
    // Pending approval
    if (profileStatus.approval_status === 'pending') {
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
                <Clock className="h-12 w-12 text-yellow-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-primary">Aguardando Aprovação</CardTitle>
              <CardDescription className="text-muted-foreground">
                {profileStatus.user_response 
                  ? 'Sua resposta foi enviada e está aguardando análise de um administrador.'
                  : 'Sua solicitação de acesso foi enviada. Um administrador precisa aprovar sua conta para que você possa acessar o sistema.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button 
                variant="outline" 
                onClick={async () => {
                  await signOut();
                  setProfileStatus(null);
                }}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Voltar ao Login
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Rejected
    if (profileStatus.approval_status === 'rejected') {
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
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold text-destructive">Acesso Negado</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sua solicitação de acesso foi negada pelo administrador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileStatus.rejection_reason && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                  <p className="text-sm font-medium text-foreground mb-1">Motivo:</p>
                  <p className="text-sm text-muted-foreground">{profileStatus.rejection_reason}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="response" className="text-foreground">Responder ao administrador</Label>
                <Textarea
                  id="response"
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  placeholder="Escreva uma resposta explicando sua situação..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSendResponse}
                  disabled={!userResponse.trim() || isSendingResponse}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSendingResponse ? 'Enviando...' : 'Enviar Resposta'}
                </Button>
              </div>

              <div className="text-center pt-2">
                <Button 
                  variant="link" 
                  onClick={async () => {
                    await signOut();
                    setProfileStatus(null);
                  }}
                  className="text-muted-foreground"
                >
                  Voltar ao Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
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
          <CardTitle className="text-2xl font-bold text-primary">Sistema Astros</CardTitle>
          <CardDescription className="text-muted-foreground">
            Gerencie seus clientes de forma eficiente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Cadastro
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-foreground">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-foreground">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-green"
                  disabled={isLoading}
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-foreground">Nome</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-foreground">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-foreground">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-green"
                  disabled={isLoading}
                >
                  {isLoading ? 'Criando conta...' : 'Criar Conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}