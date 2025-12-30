import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Mail, 
  MessageSquare, 
  UserPlus,
  Save,
  Loader2,
  Info,
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Send,
  TestTube
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
}

const AdminBoasVindas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [isSaving, setIsSaving] = useState(false);
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  
  // Welcome config states
  const [welcomeEmailEnabled, setWelcomeEmailEnabled] = useState(false);
  const [welcomeWhatsappEnabled, setWelcomeWhatsappEnabled] = useState(false);
  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState("Bem-vindo ao Sistema Astros!");
  const [welcomeEmailTemplate, setWelcomeEmailTemplate] = useState("");
  const [welcomeWhatsappTemplate, setWelcomeWhatsappTemplate] = useState("");
  
  // Gmail credentials
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");
  
  // New WhatsApp instance form
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceUrl, setNewInstanceUrl] = useState("");
  const [newInstanceKey, setNewInstanceKey] = useState("");
  
  // Test states
  const [testEmail, setTestEmail] = useState("");
  const [testWhatsApp, setTestWhatsApp] = useState("");
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);

  // Fetch config
  const { data: config, isLoading } = useQuery({
    queryKey: ['welcome-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recovery_config')
        .select('config_key, config_value')
        .in('config_key', [
          'welcome_email_enabled',
          'welcome_whatsapp_enabled',
          'welcome_email_subject',
          'welcome_email_template',
          'welcome_whatsapp_template',
          'gmail_user',
          'gmail_app_password'
        ]);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch WhatsApp instances
  const { data: whatsappInstances, isLoading: loadingInstances } = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as WhatsAppInstance[];
    }
  });

  // Load config
  useEffect(() => {
    if (config) {
      const configMap = config.reduce((acc, item) => {
        acc[item.config_key] = item.config_value;
        return acc;
      }, {} as Record<string, string>);
      
      setWelcomeEmailEnabled(configMap.welcome_email_enabled === 'true');
      setWelcomeWhatsappEnabled(configMap.welcome_whatsapp_enabled === 'true');
      setWelcomeEmailSubject(configMap.welcome_email_subject || "Bem-vindo ao Sistema Astros!");
      setWelcomeEmailTemplate(configMap.welcome_email_template || getDefaultEmailTemplate());
      setWelcomeWhatsappTemplate(configMap.welcome_whatsapp_template || getDefaultWhatsappTemplate());
      setGmailUser(configMap.gmail_user || "");
      setGmailPassword(configMap.gmail_app_password || "");
    }
  }, [config]);

  const getDefaultEmailTemplate = () => `Olá {nome},

Sua conta foi criada com sucesso no Sistema Astros!

Seus dados de acesso:
- E-mail: {email}
- Senha: {senha}

Acesse o sistema em: {url}

Atenciosamente,
Equipe Astros`;

  const getDefaultWhatsappTemplate = () => `Olá {nome}! 👋

Sua conta foi criada no Sistema Astros!

📧 E-mail: {email}
🔐 Senha: {senha}

Acesse: {url}`;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const configs = [
        { config_key: 'welcome_email_enabled', config_value: String(welcomeEmailEnabled) },
        { config_key: 'welcome_whatsapp_enabled', config_value: String(welcomeWhatsappEnabled) },
        { config_key: 'welcome_email_subject', config_value: welcomeEmailSubject },
        { config_key: 'welcome_email_template', config_value: welcomeEmailTemplate },
        { config_key: 'welcome_whatsapp_template', config_value: welcomeWhatsappTemplate },
        { config_key: 'gmail_user', config_value: gmailUser },
        { config_key: 'gmail_app_password', config_value: gmailPassword },
      ];

      for (const cfg of configs) {
        const { error } = await supabase
          .from('recovery_config')
          .upsert(cfg, { onConflict: 'config_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-config'] });
      toast({
        title: "Configurações salvas!",
        description: "As configurações de boas-vindas foram atualizadas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Add WhatsApp instance
  const addInstanceMutation = useMutation({
    mutationFn: async () => {
      if (!newInstanceName || !newInstanceUrl || !newInstanceKey) {
        throw new Error("Preencha todos os campos da instância");
      }
      
      const { error } = await supabase
        .from('whatsapp_instances')
        .insert({
          instance_name: newInstanceName,
          api_url: newInstanceUrl,
          api_key: newInstanceKey,
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      setNewInstanceName("");
      setNewInstanceUrl("");
      setNewInstanceKey("");
      toast({
        title: "Instância adicionada!",
        description: "A instância WhatsApp foi configurada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete WhatsApp instance
  const deleteInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      toast({
        title: "Instância removida!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Toggle instance active status
  const toggleInstanceMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    await saveMutation.mutateAsync();
    setIsSaving(false);
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Test email function
  const handleTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "E-mail de teste não informado",
        variant: "destructive",
      });
      return;
    }

    if (!gmailUser || !gmailPassword) {
      toast({
        title: "Credenciais Gmail não configuradas",
        description: "Configure o Gmail antes de testar o envio.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingEmail(true);
    try {
      const testMessage = welcomeEmailTemplate
        .replace(/{nome}/g, "Usuário Teste")
        .replace(/{email}/g, testEmail)
        .replace(/{senha}/g, "senha123")
        .replace(/{url}/g, window.location.origin);

      const { error } = await supabase.functions.invoke('send-welcome', {
        body: {
          testMode: true,
          channel: 'email',
          to: testEmail,
          subject: welcomeEmailSubject,
          message: testMessage,
          gmailUser,
          gmailPassword,
        },
      });

      if (error) throw error;

      toast({
        title: "E-mail de teste enviado!",
        description: `Enviado para ${testEmail}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar e-mail de teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Test WhatsApp function
  const handleTestWhatsApp = async () => {
    if (!testWhatsApp) {
      toast({
        title: "Número de teste não informado",
        variant: "destructive",
      });
      return;
    }

    const activeInstance = whatsappInstances?.find(i => i.is_active);
    if (!activeInstance) {
      toast({
        title: "Nenhuma instância WhatsApp ativa",
        description: "Ative uma instância antes de testar o envio.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingWhatsApp(true);
    try {
      const testMessage = welcomeWhatsappTemplate
        .replace(/{nome}/g, "Usuário Teste")
        .replace(/{email}/g, "teste@exemplo.com")
        .replace(/{senha}/g, "senha123")
        .replace(/{url}/g, window.location.origin);

      const { error } = await supabase.functions.invoke('send-welcome', {
        body: {
          testMode: true,
          channel: 'whatsapp',
          to: testWhatsApp,
          message: testMessage,
          whatsappInstance: activeInstance,
        },
      });

      if (error) throw error;

      toast({
        title: "Mensagem WhatsApp de teste enviada!",
        description: `Enviado para ${testWhatsApp}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar WhatsApp de teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t('welcomeMessages.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('welcomeMessages.subtitle')}</p>
              </div>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t('common.save')}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="mensagens" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mensagens" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('welcomeMessages.messages')}
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t('welcomeMessages.gmail')}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('welcomeMessages.whatsapp')}
            </TabsTrigger>
          </TabsList>

          {/* Messages Tab */}
          <TabsContent value="mensagens" className="space-y-6">
            {/* Info Card */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Variáveis disponíveis nos templates:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><code className="text-primary">{'{nome}'}</code> - Nome do usuário</li>
                      <li><code className="text-primary">{'{email}'}</code> - E-mail do usuário</li>
                      <li><code className="text-primary">{'{senha}'}</code> - Senha inicial definida</li>
                      <li><code className="text-primary">{'{url}'}</code> - Link de acesso ao sistema</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Config */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-foreground">E-mail de Boas-vindas</CardTitle>
                      <CardDescription>Enviar e-mail quando admin cria usuário</CardDescription>
                    </div>
                  </div>
                  <Switch 
                    checked={welcomeEmailEnabled} 
                    onCheckedChange={setWelcomeEmailEnabled}
                  />
                </div>
              </CardHeader>
              {welcomeEmailEnabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Assunto do E-mail</Label>
                    <Input
                      id="email-subject"
                      value={welcomeEmailSubject}
                      onChange={(e) => setWelcomeEmailSubject(e.target.value)}
                      placeholder="Bem-vindo ao Sistema!"
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-template">Corpo do E-mail</Label>
                    <Textarea
                      id="email-template"
                      value={welcomeEmailTemplate}
                      onChange={(e) => setWelcomeEmailTemplate(e.target.value)}
                      placeholder="Digite a mensagem..."
                      rows={10}
                      className="bg-background/50 font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* WhatsApp Config */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    <div>
                      <CardTitle className="text-foreground">WhatsApp de Boas-vindas</CardTitle>
                      <CardDescription>Enviar mensagem quando admin cria usuário (se telefone informado)</CardDescription>
                    </div>
                  </div>
                  <Switch 
                    checked={welcomeWhatsappEnabled} 
                    onCheckedChange={setWelcomeWhatsappEnabled}
                  />
                </div>
              </CardHeader>
              {welcomeWhatsappEnabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp-template">Mensagem do WhatsApp</Label>
                    <Textarea
                      id="whatsapp-template"
                      value={welcomeWhatsappTemplate}
                      onChange={(e) => setWelcomeWhatsappTemplate(e.target.value)}
                      placeholder="Digite a mensagem..."
                      rows={8}
                      className="bg-background/50 font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* Gmail Tab */}
          <TabsContent value="email" className="space-y-6">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle className="text-foreground">Credenciais Gmail</CardTitle>
                    <CardDescription>Configure o Gmail para envio de e-mails de boas-vindas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Como obter a Senha de App do Gmail:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Acesse sua Conta Google → Segurança</li>
                          <li>Ative a verificação em 2 etapas (se ainda não estiver)</li>
                          <li>Em "Senhas de app", crie uma nova senha</li>
                          <li>Selecione "Outro" e nomeie como "Sistema Astros"</li>
                          <li>Copie a senha gerada (16 caracteres)</li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label htmlFor="gmail-user">E-mail do Gmail</Label>
                  <Input
                    id="gmail-user"
                    type="email"
                    value={gmailUser}
                    onChange={(e) => setGmailUser(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    className="bg-background/50"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gmail-password">Senha de App</Label>
                  <div className="relative">
                    <Input
                      id="gmail-password"
                      type={showGmailPassword ? "text" : "password"}
                      value={gmailPassword}
                      onChange={(e) => setGmailPassword(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="bg-background/50 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowGmailPassword(!showGmailPassword)}
                    >
                      {showGmailPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Test Email Section */}
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <TestTube className="h-5 w-5 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground mb-3">Testar Envio de E-mail</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="email@teste.com"
                            className="bg-background/50 flex-1"
                          />
                          <Button
                            onClick={handleTestEmail}
                            disabled={isTestingEmail || !testEmail}
                            variant="outline"
                            className="border-green-500/50 hover:bg-green-500/10"
                          >
                            {isTestingEmail ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Enviar Teste
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="space-y-6">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-green-500" />
                  <div>
                    <CardTitle className="text-foreground">Instâncias Evolution API</CardTitle>
                    <CardDescription>Configure instâncias WhatsApp para envio de boas-vindas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add new instance form */}
                <div className="p-4 border border-dashed border-border rounded-lg space-y-4">
                  <p className="text-sm font-medium text-foreground">Adicionar Nova Instância</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="instance-name">Nome da Instância</Label>
                      <Input
                        id="instance-name"
                        value={newInstanceName}
                        onChange={(e) => setNewInstanceName(e.target.value)}
                        placeholder="ex: whatsapp-01"
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instance-url">URL da API</Label>
                      <Input
                        id="instance-url"
                        value={newInstanceUrl}
                        onChange={(e) => setNewInstanceUrl(e.target.value)}
                        placeholder="https://api.evolution.com"
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instance-key">API Key</Label>
                      <Input
                        id="instance-key"
                        value={newInstanceKey}
                        onChange={(e) => setNewInstanceKey(e.target.value)}
                        placeholder="sua-api-key"
                        className="bg-background/50"
                        type="password"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => addInstanceMutation.mutate()}
                    disabled={addInstanceMutation.isPending || !newInstanceName || !newInstanceUrl || !newInstanceKey}
                    className="w-full md:w-auto"
                  >
                    {addInstanceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Adicionar Instância
                  </Button>
                </div>

                {/* List of instances */}
                {loadingInstances ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : whatsappInstances && whatsappInstances.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Instâncias Configuradas</p>
                    {whatsappInstances.map((instance) => (
                      <div 
                        key={instance.id} 
                        className="p-4 border border-border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{instance.instance_name}</span>
                            {instance.is_active ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Ativa</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inativa</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{instance.api_url}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">
                              API Key: {showApiKeys[instance.id] ? instance.api_key : '••••••••••••'}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleApiKeyVisibility(instance.id)}
                            >
                              {showApiKeys[instance.id] ? (
                                <EyeOff className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <Eye className="h-3 w-3 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={instance.is_active}
                            onCheckedChange={(checked) => 
                              toggleInstanceMutation.mutate({ id: instance.id, is_active: checked })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteInstanceMutation.mutate(instance.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma instância WhatsApp configurada</p>
                  </div>
                )}

                {/* Test WhatsApp Section */}
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <TestTube className="h-5 w-5 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-foreground mb-3">Testar Envio de WhatsApp</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input
                            value={testWhatsApp}
                            onChange={(e) => setTestWhatsApp(e.target.value)}
                            placeholder="55 11 99999-9999"
                            className="bg-background/50 flex-1"
                          />
                          <Button
                            onClick={handleTestWhatsApp}
                            disabled={isTestingWhatsApp || !testWhatsApp}
                            variant="outline"
                            className="border-green-500/50 hover:bg-green-500/10"
                          >
                            {isTestingWhatsApp ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Enviar Teste
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Usa a instância ativa para enviar uma mensagem de teste.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminBoasVindas;
