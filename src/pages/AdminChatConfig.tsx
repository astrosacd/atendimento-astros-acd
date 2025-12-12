import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  ArrowLeft,
  MessageCircle,
  Save,
  Bot,
  Sparkles,
  Clock,
  MessageSquare
} from "lucide-react";

const AdminChatConfig = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [config, setConfig] = useState({
    chat_enabled: false,
    chat_name: 'Lyra',
    chat_welcome_message: 'Olá! Sou a Lyra, sua assistente virtual. Como posso ajudar?',
    chat_placeholder: 'Digite sua mensagem...',
    chat_auto_open: false,
    chat_response_delay: '0',
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('billing_config')
        .select('config_key, config_value')
        .in('config_key', [
          'chat_enabled',
          'chat_name',
          'chat_welcome_message',
          'chat_placeholder',
          'chat_auto_open',
          'chat_response_delay'
        ]);

      if (data) {
        const configMap: Record<string, string> = {};
        data.forEach(item => {
          configMap[item.config_key] = item.config_value;
        });
        
        setConfig({
          chat_enabled: configMap.chat_enabled === 'true',
          chat_name: configMap.chat_name || 'Lyra',
          chat_welcome_message: configMap.chat_welcome_message || 'Olá! Sou a Lyra, sua assistente virtual. Como posso ajudar?',
          chat_placeholder: configMap.chat_placeholder || 'Digite sua mensagem...',
          chat_auto_open: configMap.chat_auto_open === 'true',
          chat_response_delay: configMap.chat_response_delay || '0',
        });
      }
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const updates = [
        { config_key: 'chat_enabled', config_value: config.chat_enabled ? 'true' : 'false' },
        { config_key: 'chat_name', config_value: config.chat_name },
        { config_key: 'chat_welcome_message', config_value: config.chat_welcome_message },
        { config_key: 'chat_placeholder', config_value: config.chat_placeholder },
        { config_key: 'chat_auto_open', config_value: config.chat_auto_open ? 'true' : 'false' },
        { config_key: 'chat_response_delay', config_value: config.chat_response_delay },
      ];

      for (const update of updates) {
        const { data: existing } = await supabase
          .from('billing_config')
          .select('id')
          .eq('config_key', update.config_key)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('billing_config')
            .update({ config_value: update.config_value })
            .eq('config_key', update.config_key);
        } else {
          await supabase
            .from('billing_config')
            .insert(update);
        }
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Chat de Ajuda (Lyra)</h1>
                <p className="text-sm text-muted-foreground">Configurar assistente virtual</p>
              </div>
            </div>
          </div>
          <Button onClick={saveConfig} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status */}
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <CardTitle>Status do Chat</CardTitle>
                  <CardDescription>Ativar ou desativar o assistente</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="chat-enabled" className="font-medium">Habilitar Chat</Label>
                  <p className="text-sm text-muted-foreground">Exibir botão do chat no menu lateral</p>
                </div>
                <Switch
                  id="chat-enabled"
                  checked={config.chat_enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, chat_enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="chat-auto-open" className="font-medium">Abrir Automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Abrir chat quando usuário acessa o sistema</p>
                </div>
                <Switch
                  id="chat-auto-open"
                  checked={config.chat_auto_open}
                  onCheckedChange={(checked) => setConfig({ ...config, chat_auto_open: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Personalização */}
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle>Personalização</CardTitle>
                  <CardDescription>Customizar nome e aparência</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chat-name">Nome do Assistente</Label>
                <Input
                  id="chat-name"
                  value={config.chat_name}
                  onChange={(e) => setConfig({ ...config, chat_name: e.target.value })}
                  placeholder="Lyra"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chat-placeholder">Placeholder do Campo</Label>
                <Input
                  id="chat-placeholder"
                  value={config.chat_placeholder}
                  onChange={(e) => setConfig({ ...config, chat_placeholder: e.target.value })}
                  placeholder="Digite sua mensagem..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Mensagens */}
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Mensagens</CardTitle>
                  <CardDescription>Configurar mensagens padrão</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chat-welcome">Mensagem de Boas-vindas</Label>
                <Textarea
                  id="chat-welcome"
                  value={config.chat_welcome_message}
                  onChange={(e) => setConfig({ ...config, chat_welcome_message: e.target.value })}
                  placeholder="Olá! Sou a Lyra, sua assistente virtual. Como posso ajudar?"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Comportamento */}
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle>Comportamento</CardTitle>
                  <CardDescription>Configurar comportamento do chat</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="response-delay">Delay de Resposta (ms)</Label>
                <Input
                  id="response-delay"
                  type="number"
                  min="0"
                  max="5000"
                  value={config.chat_response_delay}
                  onChange={(e) => setConfig({ ...config, chat_response_delay: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Tempo de espera antes de exibir resposta (simula digitação). 0 = instantâneo.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminChatConfig;
