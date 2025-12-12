import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  Users, 
  KeyRound, 
  Settings, 
  Shield,
  ArrowLeft,
  UserCheck,
  Database,
  MessageCircle
} from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatEnabled, setChatEnabled] = useState(false);
  const [savingChat, setSavingChat] = useState(false);

  useEffect(() => {
    const loadChatConfig = async () => {
      const { data } = await supabase
        .from('billing_config')
        .select('config_value')
        .eq('config_key', 'chat_enabled')
        .maybeSingle();
      setChatEnabled(data?.config_value === 'true');
    };
    loadChatConfig();
  }, []);

  const handleChatToggle = async (enabled: boolean) => {
    setSavingChat(true);
    try {
      const { data: existing } = await supabase
        .from('billing_config')
        .select('id')
        .eq('config_key', 'chat_enabled')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('billing_config')
          .update({ config_value: enabled ? 'true' : 'false' })
          .eq('config_key', 'chat_enabled');
      } else {
        await supabase
          .from('billing_config')
          .insert({ config_key: 'chat_enabled', config_value: enabled ? 'true' : 'false' });
      }
      setChatEnabled(enabled);
      toast.success(enabled ? 'Chat de ajuda ativado' : 'Chat de ajuda desativado');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingChat(false);
    }
  };

  const adminModules = [
    {
      title: "Gerenciar Usuários",
      description: "Aprovar, rejeitar e gerenciar contas e permissões",
      icon: Users,
      path: "/usuarios",
      color: "from-blue-500/20 to-blue-600/10"
    },
    {
      title: "Recuperação de Senha",
      description: "Configurar métodos de recuperação de senha",
      icon: KeyRound,
      path: "/admin/recuperacao-senha",
      color: "from-amber-500/20 to-amber-600/10"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Painel Administrativo</h1>
                <p className="text-sm text-muted-foreground">Gerenciamento do sistema</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Módulos Ativos</p>
                  <p className="text-2xl font-bold text-foreground">{adminModules.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nível de Acesso</p>
                  <p className="text-2xl font-bold text-foreground">Admin</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sistema</p>
                  <p className="text-2xl font-bold text-foreground">Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Modules */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Módulos de Administração</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.map((module) => (
            <Card 
              key={module.title}
              className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer group"
              onClick={() => navigate(module.path)}
            >
              <CardHeader>
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300`}>
                  <module.icon className="h-7 w-7 text-foreground" />
                </div>
                <CardTitle className="text-foreground group-hover:text-primary transition-colors">
                  {module.title}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {module.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  Acessar módulo →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chat Configuration */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Configurações Gerais</h2>
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <Label htmlFor="chat-toggle" className="text-foreground font-medium">Chat de Ajuda (Lyra)</Label>
                    <p className="text-sm text-muted-foreground">Habilitar assistente virtual no menu lateral</p>
                  </div>
                </div>
                <Switch
                  id="chat-toggle"
                  checked={chatEnabled}
                  onCheckedChange={handleChatToggle}
                  disabled={savingChat}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
