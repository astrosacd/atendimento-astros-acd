import { useState } from "react";
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
  Settings2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface UserProfile {
  user_id: string;
  name: string;
  email: string | null;
}

interface WhatsAppInstance {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
}

const AdminRecuperacaoSenha = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Email config
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [gmailUser, setGmailUser] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  
  // WhatsApp instances
  const [showWhatsappConfig, setShowWhatsappConfig] = useState(false);
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstance[]>([
    { id: '1', name: 'Instância Principal', apiUrl: '', apiKey: '' }
  ]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('1');

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

  const addWhatsAppInstance = () => {
    const newId = String(Date.now());
    setWhatsappInstances([
      ...whatsappInstances,
      { id: newId, name: `Instância ${whatsappInstances.length + 1}`, apiUrl: '', apiKey: '' }
    ]);
  };

  const removeWhatsAppInstance = (id: string) => {
    if (whatsappInstances.length > 1) {
      setWhatsappInstances(whatsappInstances.filter(inst => inst.id !== id));
      if (selectedInstanceId === id) {
        setSelectedInstanceId(whatsappInstances[0].id);
      }
    }
  };

  const updateWhatsAppInstance = (id: string, field: keyof WhatsAppInstance, value: string) => {
    setWhatsappInstances(whatsappInstances.map(inst => 
      inst.id === id ? { ...inst, [field]: value } : inst
    ));
  };

  // Rotação de instâncias - pega a próxima instância disponível
  const getNextInstance = () => {
    const validInstances = whatsappInstances.filter(inst => inst.apiUrl && inst.apiKey);
    if (validInstances.length === 0) return null;
    
    // Rotação simples baseada no timestamp
    const index = Date.now() % validInstances.length;
    return validInstances[index];
  };

  const handleSendRecoveryEmail = async () => {
    if (!selectedUser?.email) {
      toast({
        title: "Erro",
        description: "Usuário não possui email cadastrado",
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

      toast({
        title: "Email enviado!",
        description: `Link de recuperação enviado para ${selectedUser.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendRecoveryWhatsApp = async () => {
    if (!whatsappNumber) {
      toast({
        title: "Erro",
        description: "Informe o número do WhatsApp",
        variant: "destructive"
      });
      return;
    }

    if (!selectedUser) {
      toast({
        title: "Erro",
        description: "Selecione um usuário",
        variant: "destructive"
      });
      return;
    }

    const instance = getNextInstance();
    if (!instance) {
      toast({
        title: "Erro",
        description: "Configure pelo menos uma instância do WhatsApp",
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
          instanceName: instance.name,
          apiUrl: instance.apiUrl,
          apiKey: instance.apiKey
        }
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada!",
        description: `Link enviado via ${instance.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar WhatsApp",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
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
                <h1 className="text-xl font-bold text-foreground">Recuperação de Senha</h1>
                <p className="text-sm text-muted-foreground">Enviar link de recuperação para usuários</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Configurações de Métodos */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground">Métodos de Recuperação</CardTitle>
            <CardDescription>Configure quais métodos estão disponíveis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email Config */}
            <div className="p-4 rounded-lg bg-muted/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">Enviar link por email (Gmail)</p>
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
                      Enviar link via Evolution API ({whatsappInstances.length} instância{whatsappInstances.length > 1 ? 's' : ''})
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Configure as instâncias da Evolution API (rotação automática)
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addWhatsAppInstance}
                      className="text-primary border-primary/40 hover:bg-primary/10"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {whatsappInstances.map((instance, index) => (
                      <div key={instance.id} className="p-4 rounded-lg bg-background/50 border border-border/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <Input
                            value={instance.name}
                            onChange={(e) => updateWhatsAppInstance(instance.id, 'name', e.target.value)}
                            className="bg-transparent border-none p-0 h-auto font-medium text-foreground focus-visible:ring-0"
                            placeholder="Nome da instância"
                          />
                          {whatsappInstances.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeWhatsAppInstance(instance.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">URL da API</Label>
                            <Input
                              placeholder="https://api.evolution.com/instance"
                              value={instance.apiUrl}
                              onChange={(e) => updateWhatsAppInstance(instance.id, 'apiUrl', e.target.value)}
                              className="bg-background/50 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">API Key</Label>
                            <Input
                              type="password"
                              placeholder="••••••••••••••••"
                              value={instance.apiKey}
                              onChange={(e) => updateWhatsAppInstance(instance.id, 'apiKey', e.target.value)}
                              className="bg-background/50 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
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
                  filteredUsers.map((user) => (
                    <div
                      key={user.user_id}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedUser?.user_id === user.user_id
                          ? 'bg-primary/20 border border-primary/40'
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email || 'Sem email'}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </main>
    </div>
  );
};

export default AdminRecuperacaoSenha;