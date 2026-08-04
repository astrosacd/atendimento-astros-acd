import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useTranslation } from 'react-i18next';
import logoLoginAsset from '@/assets/logo-login.png.asset.json';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'Número de WhatsApp inválido').regex(/^\d+$/, 'Apenas números'),
});

interface ProfileStatus {
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  user_response: string | null;
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCode = searchParams.get('codigo');
  const { t } = useTranslation(); // Note: t might be used later in the file, checking...
  const { user, isApproved, signIn, signUp, signOut, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [userResponse, setUserResponse] = useState('');
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  const [rejectedEmail, setRejectedEmail] = useState<string | null>(null);
  const [correctCode, setCorrectCode] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(true);
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ name: '', email: '', phone: '' });

  // reCAPTCHA v2 ("I'm not a robot") — config carregada do banco via RPC pública
  const [recaptcha, setRecaptcha] = useState<{ enabled: boolean; siteKey: string }>({ enabled: false, siteKey: '' });
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaWidgetId, setRecaptchaWidgetId] = useState<number | null>(null);
  const [activeAuthTab, setActiveAuthTab] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_recaptcha_public_config');
      const cfg = (data as any) || {};
      if (cfg.enabled && cfg.site_key) {
        setRecaptcha({ enabled: true, siteKey: cfg.site_key });
      }
    })();
  }, []);

  useEffect(() => {
    if (!recaptcha.enabled || !recaptcha.siteKey) return;
    const containerId = activeAuthTab === 'login' ? 'recaptcha-login-container' : 'recaptcha-signup-container';

    const ensureScript = () =>
      new Promise<void>((resolve) => {
        if ((window as any).grecaptcha?.render) return resolve();
        if (!document.getElementById('recaptcha-v2-script')) {
          const s = document.createElement('script');
          s.id = 'recaptcha-v2-script';
          s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
          s.async = true;
          s.defer = true;
          document.head.appendChild(s);
        }
        const wait = setInterval(() => {
          if ((window as any).grecaptcha?.render) { clearInterval(wait); resolve(); }
        }, 150);
      });

    let cancelled = false;
    ensureScript().then(() => {
      if (cancelled) return;
      // Aguarda o container existir no DOM (após mudança de tab)
      const tryRender = (attempt = 0) => {
        const el = document.getElementById(containerId);
        if (!el) {
          if (attempt < 20) setTimeout(() => tryRender(attempt + 1), 100);
          return;
        }
        if (el.childElementCount > 0) return;
        try {
          setRecaptchaToken(null);
          const id = (window as any).grecaptcha.render(el, {
            sitekey: recaptcha.siteKey,
            callback: (token: string) => setRecaptchaToken(token),
            'expired-callback': () => setRecaptchaToken(null),
            'error-callback': () => setRecaptchaToken(null),
          });
          setRecaptchaWidgetId(id);
        } catch (e) {
          console.warn('reCAPTCHA render error', e);
        }
      };
      tryRender();
    });
    return () => { cancelled = true; };
  }, [recaptcha, activeAuthTab]);

  const resetRecaptcha = () => {
    setRecaptchaToken(null);
    if (recaptchaWidgetId !== null && (window as any).grecaptcha?.reset) {
      try { (window as any).grecaptcha.reset(recaptchaWidgetId); } catch {}
    }
  };

  // Buscar o código de acesso correto
  useEffect(() => {
    const fetchCorrectCode = async () => {
      try {
        const { data, error } = await supabase.rpc('get_auth_access_code');
        if (!error && data) {
          setCorrectCode(data);
        } else {
          // Fallback se não encontrar no banco
          setCorrectCode('astros2024');
        }
      } catch (err) {
        setCorrectCode('astros2024');
      } finally {
        setIsVerifyingCode(false);
      }
    };

    fetchCorrectCode();
  }, []);

  // Função para buscar status do perfil
  const fetchProfileStatus = async () => {
    if (!user) return;
    
    setIsLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('approval_status, rejection_reason, user_response')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setProfileStatus(data as ProfileStatus);
    }
    setIsLoadingProfile(false);
  };

  // Redirect logic for approved users
  useEffect(() => {
    if (authLoading) return;

    // If user is approved, redirect immediately
    if (user && isApproved) {
      navigate('/');
      return;
    }

    // If user exists but not approved yet, wait briefly before fetching status.
    if (user && !isApproved && !profileStatus) {
      let cancelled = false;
      const t = window.setTimeout(() => {
        if (!cancelled) fetchProfileStatus();
      }, 200);

      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
  }, [user, isApproved, authLoading, navigate, profileStatus]);

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

    if (recaptcha.enabled && !recaptchaToken) {
      toast({
        title: 'Verificação necessária',
        description: 'Marque "Não sou um robô" para continuar.',
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
      resetRecaptcha();
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

    if (recaptcha.enabled && !recaptchaToken) {
      toast({
        title: 'Verificação necessária',
        description: 'Marque "Não sou um robô" para continuar.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    // Check if email already exists and was rejected
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id, approval_status, rejection_reason, user_response')
      .eq('email', signupData.email.toLowerCase().trim())
      .maybeSingle();

    if (existingProfile) {
      // If rejected, show rejection screen instead of error
      if (existingProfile.approval_status === 'rejected') {
        setRejectedEmail(signupData.email);
        setProfileStatus({
          approval_status: 'rejected',
          rejection_reason: existingProfile.rejection_reason,
          user_response: existingProfile.user_response
        });
        setIsLoading(false);
        return;
      }
      
      // If pending, show pending screen
      if (existingProfile.approval_status === 'pending') {
        toast({
          title: 'Solicitação já existe',
          description: 'Sua solicitação está aguardando aprovação do administrador.',
        });
        setIsLoading(false);
        return;
      }
      
      // If approved, tell them to login
      if (existingProfile.approval_status === 'approved') {
        toast({
          title: 'Conta já aprovada',
          description: 'Sua conta já foi aprovada. Use a aba Login para entrar.',
        });
        setIsLoading(false);
        return;
      }
    }
    
    // Generate a temporary password - user will receive the real one via welcome email
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    
    const { error } = await signUp(signupData.email, tempPassword, signupData.name, signupData.phone);
    setIsLoading(false);

    if (error) {
      // Check again if it's already registered but wasn't found before
      if (error.message.includes('already registered')) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('approval_status, rejection_reason, user_response')
          .eq('email', signupData.email.toLowerCase().trim())
          .maybeSingle();
        
        if (profile) {
          if (profile.approval_status === 'rejected') {
            setRejectedEmail(signupData.email);
            setProfileStatus({
              approval_status: 'rejected',
              rejection_reason: profile.rejection_reason,
              user_response: profile.user_response
            });
            return;
          }

          if (profile.approval_status === 'pending') {
            toast({
              title: 'Solicitação já existe',
              description: 'Sua solicitação está aguardando aprovação do administrador.',
            });
            return;
          }

          if (profile.approval_status === 'approved') {
            toast({
              title: 'Conta já aprovada',
              description: 'Sua conta já foi aprovada. Use a aba Login para entrar.',
            });
            return;
          }
        }
        
        toast({
          title: 'Email já cadastrado',
          description: 'Use a aba Login para entrar ou solicite recuperação de senha.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Erro ao criar conta. Tente novamente.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Solicitação enviada!',
        description: 'Aguarde a aprovação de um administrador. Você receberá suas credenciais por email/WhatsApp.',
      });
      setProfileStatus({ approval_status: 'pending', rejection_reason: null, user_response: null });
    }
  };

  const handleSendResponse = async () => {
    if (!userResponse.trim()) return;
    
    // Use user.id if logged in, otherwise use email from signup form
    const emailToUpdate = user ? null : rejectedEmail || signupData.email;

    setIsSendingResponse(true);
    
    let updateResult;
    if (user) {
      updateResult = await supabase
        .from('profiles')
        .update({ user_response: userResponse, approval_status: 'pending' })
        .eq('user_id', user.id);
    } else if (emailToUpdate) {
      updateResult = await supabase
        .from('profiles')
        .update({ user_response: userResponse, approval_status: 'pending' })
        .eq('email', emailToUpdate);
    } else {
      setIsSendingResponse(false);
      toast({
        title: 'Erro',
        description: 'Não foi possível identificar o usuário.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingResponse(false);

    if (updateResult.error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar sua resposta.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Resposta enviada!',
        description: 'Sua resposta foi enviada para análise do administrador.',
      });
      setProfileStatus(prev => prev ? { ...prev, user_response: userResponse, approval_status: 'pending' } : null);
      setUserResponse('');
    }
  };


  if (isVerifyingCode || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  // Trava de segurança: exige o código correto na URL (?codigo=...)
  if (urlCode !== correctCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md bg-card border-border border-2 border-destructive/20 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <img
              src={logoLoginAsset.url}
              alt="Astros Comunicação Digital"
              className="h-24 mx-auto mb-2"
            />
            <div className="flex justify-center">
              <div className="bg-destructive/10 p-4 rounded-full">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-destructive">Acesso Restrito</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Esta página de acesso é privada e protegida.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="bg-muted p-4 rounded-lg border border-border">
              <p className="text-sm text-foreground font-medium">
                Você precisa do link de acesso oficial para visualizar esta tela.
              </p>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Se você é um colaborador e não possui o link, solicite ao seu gestor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show status screens for users awaiting approval (logged-in or rejected via signup)
  if ((user && profileStatus) || (!user && profileStatus)) {
    // Pending approval
    if (profileStatus.approval_status === 'pending') {
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
                  if (user) await signOut();
                  setProfileStatus(null);
                  setRejectedEmail(null);
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
                src={logoLoginAsset.url}
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
                    if (user) await signOut();
                    setProfileStatus(null);
                    setRejectedEmail(null);
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
            src={logoLoginAsset.url}
            alt="Astros Comunicação Digital"
            className="h-20 mx-auto"
          />
          <CardTitle className="text-2xl font-bold text-primary">Sistema Astros</CardTitle>
          <CardDescription className="text-muted-foreground">
            Gerencie seus clientes de forma eficiente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user && !isApproved && isLoadingProfile && (
            <div className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Verificando status da sua conta…
            </div>
          )}
          <Tabs value={activeAuthTab} onValueChange={(v) => setActiveAuthTab(v as 'login' | 'signup')} className="w-full">
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
                {recaptcha.enabled && recaptcha.siteKey && (
                  <div className="flex justify-center pt-1">
                    <div id="recaptcha-login-container" />
                  </div>
                )}
                {(!recaptcha.enabled || !!recaptchaToken) && (
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-green animate-in fade-in duration-300"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Entrando...' : 'Entrar'}
                  </Button>
                )}
                
                <div className="text-center pt-2">
                  <Button 
                    type="button"
                    variant="link" 
                    onClick={() => navigate('/recuperar-senha')}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Esqueci minha senha
                  </Button>
                </div>
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
                  <Label htmlFor="signup-phone" className="text-foreground">WhatsApp</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="11999999999"
                    value={signupData.phone}
                    onChange={(e) => setSignupData({ ...signupData, phone: e.target.value.replace(/\D/g, '') })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Apenas números, com DDD</p>
                </div>
                {recaptcha.enabled && recaptcha.siteKey && (
                  <div className="flex justify-center pt-1">
                    <div id="recaptcha-signup-container" />
                  </div>
                )}
                {(!recaptcha.enabled || !!recaptchaToken) && (
                  <Button 
                    type="submit" 
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-green animate-in fade-in duration-300"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Enviando solicitação...' : 'Solicitar Acesso'}
                  </Button>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}