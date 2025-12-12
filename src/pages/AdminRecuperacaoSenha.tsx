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
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface UserProfile {
  user_id: string;
  name: string;
  email: string | null;
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

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset-whatsapp', {
        body: { 
          userId: selectedUser.user_id,
          phone: whatsappNumber,
          userName: selectedUser.name
        }
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada!",
        description: `Link de recuperação enviado via WhatsApp`,
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

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Configurações */}
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="text-foreground">Métodos de Recuperação</CardTitle>
            <CardDescription>Configure quais métodos estão disponíveis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">Enviar link por email</p>
                </div>
              </div>
              <Switch 
                checked={emailEnabled} 
                onCheckedChange={setEmailEnabled}
              />
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-foreground">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">Enviar link via Evolution API</p>
                </div>
              </div>
              <Switch 
                checked={whatsappEnabled} 
                onCheckedChange={setWhatsappEnabled}
              />
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

        {/* Ações de Recuperação */}
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
                    className="w-full"
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
                    className="w-full bg-green-600 hover:bg-green-700"
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
