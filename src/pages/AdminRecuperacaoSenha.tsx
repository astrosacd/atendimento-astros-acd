import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Mail, 
  MessageSquare, 
  KeyRound,
  Search,
  Send,
  User,
  Plus,
  Trash2,
  Settings2,
  Save,
  History,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTranslation } from 'react-i18next';

interface UserProfile {
  user_id: string;
  name: string;
  email: string | null;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
}

interface RecoveryLog {
  id: string;
  user_email: string;
  recovery_method: string;
  status: string;
  error_message: string | null;
  created_at: string;
  whatsapp_instance_id: string | null;
}

const AdminRecuperacaoSenha = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  // Email config
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [gmailUser, setGmailUser] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  
  // WhatsApp instances
  const [showWhatsappConfig, setShowWhatsappConfig] = useState(false);
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstance[]>([]);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceApiUrl, setNewInstanceApiUrl] = useState("");
  const [newInstanceApiKey, setNewInstanceApiKey] = useState("");

  // Fetch Gmail config
  const { data: gmailConfig } = useQuery({
    queryKey: ['gmail-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recovery_config')
        .select('config_key, config_value')
        .in('config_key', ['gmail_user', 'gmail_app_password', 'email_enabled', 'whatsapp_enabled']);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch WhatsApp instances
  const { data: dbInstances = [], isLoading: isLoadingInstances } = useQuery({
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

  // Fetch recovery logs
  const { data: recoveryLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['recovery-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('password_recovery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as RecoveryLog[];
    }
  });

  // Load config from database
  useEffect(() => {
    if (gmailConfig) {
      const config = gmailConfig.reduce((acc, item) => {
        acc[item.config_key] = item.config_value;
        return acc;
      }, {} as Record<string, string>);
      
      setGmailUser(config.gmail_user || '');
      setGmailAppPassword(config.gmail_app_password || '');
      setEmailEnabled(config.email_enabled !== 'false');
      setWhatsappEnabled(config.whatsapp_enabled !== 'false');
    }
  }, [gmailConfig]);

  useEffect(() => {
    if (dbInstances.length > 0) {
      setWhatsappInstances(dbInstances);
    }
  }, [dbInstances]);

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users-for-recovery'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .eq('approved', true);
      
      if (error) throw error;
      return data as UserProfile[];
    }
  });

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const configs = [
        { config_key: 'gmail_user', config_value: gmailUser },
        { config_key: 'gmail_app_password', config_value: gmailAppPassword },
        { config_key: 'email_enabled', config_value: String(emailEnabled) },
        { config_key: 'whatsapp_enabled', config_value: String(whatsappEnabled) },
      ];

      for (const config of configs) {
        const { error } = await supabase
          .from('recovery_config')
          .upsert(config, { onConflict: 'config_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-config'] });
      toast({
        title: t('passwordRecovery.configSaved'),
        description: t('passwordRecovery.configSavedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('passwordRecovery.errorSaving'),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Add WhatsApp instance mutation
  const addInstanceMutation = useMutation({
    mutationFn: async (instance: { instance_name: string; api_url: string; api_key: string }) => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert(instance)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      setNewInstanceName("");
      setNewInstanceApiUrl("");
      setNewInstanceApiKey("");
      toast({
        title: t('passwordRecovery.instanceAdded'),
        description: "A instância foi salva com sucesso.",
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

  // Remove WhatsApp instance mutation
  const removeInstanceMutation = useMutation({
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

  const addWhatsAppInstance = () => {
    if (!newInstanceName || !newInstanceApiUrl || !newInstanceApiKey) {
      toast({
        title: t('passwordRecovery.fillAllFields'),
        variant: "destructive"
      });
      return;
    }
    
    addInstanceMutation.mutate({
      instance_name: newInstanceName,
      api_url: newInstanceApiUrl,
      api_key: newInstanceApiKey
    });
  };

  // Rotação de instâncias - pega a próxima instância disponível e atualiza last_used_at
  const getNextInstance = async () => {
    const activeInstances = whatsappInstances.filter(inst => inst.is_active && inst.api_url && inst.api_key);
    if (activeInstances.length === 0) return null;
    
    // Pega a instância menos usada recentemente (ou qualquer uma se nunca usada)
    const { data: leastUsed } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('is_active', true)
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .limit(1)
      .single();
    
    if (leastUsed) {
      // Atualiza last_used_at
      await supabase
        .from('whatsapp_instances')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', leastUsed.id);
      
      return leastUsed as WhatsAppInstance;
    }
    
    return activeInstances[0];
  };

  // Log recovery attempt
  const logRecoveryAttempt = async (
    userEmail: string,
    method: string,
    status: string,
    errorMessage?: string,
    instanceId?: string
  ) => {
    if (!user) return;
    
    await supabase
      .from('password_recovery_logs')
      .insert({
        user_email: userEmail,
        recovery_method: method,
        status,
        error_message: errorMessage || null,
        whatsapp_instance_id: instanceId || null,
        sent_by: user.id
      });
    
    queryClient.invalidateQueries({ queryKey: ['recovery-logs'] });
  };

  const handleSendRecoveryEmail = async () => {
    if (!selectedUser?.email) {
      toast({
        title: t('common.error'),
        description: t('passwordRecovery.noEmail'),
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-email', {
        body: { 
          userId: selectedUser.user_id,
          email: selectedUser.email,
          userName: selectedUser.name
        }
      });

      if (error) throw error;

      await logRecoveryAttempt(selectedUser.email, 'email', 'sent');

      toast({
        title: t('passwordRecovery.emailSent'),
        description: `${t('passwordRecovery.emailSentDesc')} ${selectedUser.email}`,
      });
    } catch (error: any) {
      await logRecoveryAttempt(selectedUser.email, 'email', 'error', error.message);
      toast({
        title: t('passwordRecovery.errorSendingEmail'),
        description: error.message || t('common.errorOccurred'),
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendRecoveryWhatsApp = async () => {
    if (!whatsappNumber) {
      toast({
        title: t('common.error'),
        description: t('passwordRecovery.noWhatsapp'),
        variant: "destructive"
      });
      return;
    }

    if (!selectedUser) {
      toast({
        title: t('common.error'),
        description: t('passwordRecovery.noUser'),
        variant: "destructive"
      });
      return;
    }

    const instance = await getNextInstance();
    if (!instance) {
      toast({
        title: t('common.error'),
        description: t('passwordRecovery.noActiveInstance'),
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-whatsapp', {
        body: { 
          userId: selectedUser.user_id,
          phone: whatsappNumber,
          userName: selectedUser.name,
          instanceName: instance.instance_name,
          apiUrl: instance.api_url,
          apiKey: instance.api_key
        }
      });

      if (error) throw error;

      await logRecoveryAttempt(
        selectedUser.email || whatsappNumber, 
        'whatsapp', 
        'sent', 
        undefined, 
        instance.id
      );

      toast({
        title: t('passwordRecovery.whatsappSent'),
        description: `${t('passwordRecovery.whatsappSentDesc')} ${instance.instance_name}`,
      });
    } catch (error: any) {
      await logRecoveryAttempt(
        selectedUser.email || whatsappNumber, 
        'whatsapp', 
        'error', 
        error.message, 
        instance.id
      );
      toast({
        title: t('passwordRecovery.errorSendingWhatsApp'),
        description: error.message || t('common.errorOccurred'),
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    await saveConfigMutation.mutateAsync();
    setIsSavingConfig(false);
  };

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
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t('passwordRecovery.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('passwordRecovery.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Configurações de Métodos */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground">{t('passwordRecovery.methods')}</CardTitle>
              <CardDescription>{t('passwordRecovery.methodsDesc')}</CardDescription>
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="bg-primary hover:bg-primary/90"
            >
              {isSavingConfig ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t('passwordRecovery.saveConfig')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email Config */}
            <div className="p-4 rounded-lg bg-muted/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-foreground">{t('passwordRecovery.email')}</p>
                    <p className="text-sm text-muted-foreground">{t('passwordRecovery.emailDesc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmailConfig(!showEmailConfig)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Switch 
                    checked={emailEnabled} 
                    onCheckedChange={setEmailEnabled}
                  />
                </div>
              </div>
              
              {showEmailConfig && (
                <div className="pt-4 border-t border-border/40 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure as credenciais do Gmail para envio de emails
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gmail-user">Email do Gmail</Label>
                      <Input
                        id="gmail-user"
                        type="email"
                        placeholder="seu@gmail.com"
                        value={gmailUser}
                        onChange={(e) => setGmailUser(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gmail-password">Senha de App</Label>
                      <Input
                        id="gmail-password"
                        type="password"
                        placeholder="••••••••••••••••"
                        value={gmailAppPassword}
                        onChange={(e) => setGmailAppPassword(e.target.value)}
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use uma senha de app do Google (não sua senha normal). 
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                      Criar senha de app
                    </a>
                  </p>
                </div>
              )}
            </div>
            
            {/* WhatsApp Config */}
            <div className="p-4 rounded-lg bg-muted/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-foreground">WhatsApp</p>
                    <p className="text-sm text-muted-foreground">
                      Enviar link via Evolution API ({whatsappInstances.length} instância{whatsappInstances.length !== 1 ? 's' : ''})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowWhatsappConfig(!showWhatsappConfig)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Switch 
                    checked={whatsappEnabled} 
                    onCheckedChange={setWhatsappEnabled}
                  />
                </div>
              </div>
              
              {showWhatsappConfig && (
                <div className="pt-4 border-t border-border/40 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure as instâncias da Evolution API (rotação automática)
                  </p>
                  
                  {/* Lista de instâncias existentes */}
                  {isLoadingInstances ? (
                    <div className="text-center py-4 text-muted-foreground">Carregando...</div>
                  ) : (
                    <div className="space-y-3">
                      {whatsappInstances.map((instance) => (
                        <div key={instance.id} className="p-3 rounded-lg bg-background/50 border border-border/40 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{instance.instance_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{instance.api_url}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeInstanceMutation.mutate(instance.id)}
                            disabled={removeInstanceMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Adicionar nova instância */}
                  <div className="p-4 rounded-lg bg-background/30 border border-dashed border-border/60 space-y-3">
                    <p className="text-sm font-medium text-foreground">Adicionar Nova Instância</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <Input
                          placeholder="Ex: Instância 1"
                          value={newInstanceName}
                          onChange={(e) => setNewInstanceName(e.target.value)}
                          className="bg-background/50 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">URL da API</Label>
                        <Input
                          placeholder="https://api.evolution..."
                          value={newInstanceApiUrl}
                          onChange={(e) => setNewInstanceApiUrl(e.target.value)}
                          className="bg-background/50 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">API Key</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={newInstanceApiKey}
                          onChange={(e) => setNewInstanceApiKey(e.target.value)}
                          className="bg-background/50 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addWhatsAppInstance}
                      disabled={addInstanceMutation.isPending}
                      className="text-primary border-primary/40 hover:bg-primary/10"
                    >
                      {addInstanceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      Adicionar Instância
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Com múltiplas instâncias, o sistema faz rotação automática para não sobrecarregar um único número.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Buscar Usuário */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground">Selecionar Usuário</CardTitle>
            <CardDescription>Busque o usuário que precisa recuperar a senha</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50"
              />
            </div>

            {isLoadingUsers ? (
              <div className="text-center py-4 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Nenhum usuário encontrado
                  </div>
                ) : (
                  filteredUsers.map((userItem) => (
                    <div
                      key={userItem.user_id}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedUser?.user_id === userItem.user_id
                          ? 'bg-primary/20 border border-primary/40'
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedUser(userItem)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{userItem.name}</p>
                          <p className="text-sm text-muted-foreground">{userItem.email || 'Sem email'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações de Recuperação - Layout lado a lado */}
        {selectedUser && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Email */}
            {emailEnabled && (
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-foreground">Enviar por Email</CardTitle>
                  </div>
                  <CardDescription>
                    Enviar link para: {selectedUser.email || 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleSendRecoveryEmail}
                    disabled={!selectedUser.email || isSending}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Enviando...' : 'Enviar Email'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* WhatsApp */}
            {whatsappEnabled && (
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-foreground">Enviar por WhatsApp</CardTitle>
                  </div>
                  <CardDescription>
                    Informe o número do WhatsApp do usuário
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">Número do WhatsApp</Label>
                    <Input
                      id="whatsapp"
                      placeholder="5511999999999"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="bg-background/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formato: código do país + DDD + número (sem espaços ou traços)
                    </p>
                  </div>
                  <Button 
                    onClick={handleSendRecoveryWhatsApp}
                    disabled={!whatsappNumber || isSending}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Enviando...' : 'Enviar WhatsApp'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Histórico de Recuperações */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-foreground">Histórico de Recuperações</CardTitle>
            </div>
            <CardDescription>Últimas 50 tentativas de recuperação de senha</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Carregando histórico...
              </div>
            ) : recoveryLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma recuperação registrada ainda
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recoveryLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      log.status === 'sent' ? 'bg-green-500/10' : 'bg-destructive/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {log.recovery_method === 'email' ? (
                        <Mail className="h-4 w-4 text-blue-500" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{log.user_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded ${
                      log.status === 'sent' 
                        ? 'bg-green-500/20 text-green-600' 
                        : 'bg-destructive/20 text-destructive'
                    }`}>
                      {log.status === 'sent' ? 'Enviado' : 'Erro'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminRecuperacaoSenha;
