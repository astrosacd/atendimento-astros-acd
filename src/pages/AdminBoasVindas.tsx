import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Mail, 
  MessageSquare, 
  UserPlus,
  Save,
  Loader2,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const AdminBoasVindas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Welcome config states
  const [welcomeEmailEnabled, setWelcomeEmailEnabled] = useState(false);
  const [welcomeWhatsappEnabled, setWelcomeWhatsappEnabled] = useState(false);
  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState("Bem-vindo ao Sistema Astros!");
  const [welcomeEmailTemplate, setWelcomeEmailTemplate] = useState("");
  const [welcomeWhatsappTemplate, setWelcomeWhatsappTemplate] = useState("");

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
          'welcome_whatsapp_template'
        ]);
      
      if (error) throw error;
      return data;
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

  const handleSave = async () => {
    setIsSaving(true);
    await saveMutation.mutateAsync();
    setIsSaving(false);
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
                <h1 className="text-xl font-bold text-foreground">Mensagens de Boas-vindas</h1>
                <p className="text-sm text-muted-foreground">Configure o envio automático para novos usuários</p>
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
            Salvar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
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
              <p className="text-xs text-muted-foreground">
                As credenciais do Gmail são configuradas em <strong>Recuperação de Senha</strong>.
              </p>
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
              <p className="text-xs text-muted-foreground">
                As instâncias WhatsApp são configuradas em <strong>Recuperação de Senha</strong>.
              </p>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminBoasVindas;
