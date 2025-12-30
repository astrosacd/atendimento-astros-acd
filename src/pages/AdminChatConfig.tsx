import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft,
  MessageCircle,
  Save,
  Bot,
  Sparkles,
  Clock,
  MessageSquare,
  Palette,
  Brain,
  ListChecks,
  Plus,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  Shield,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface CustomRole {
  id: string;
  name: string;
  display_name: string;
}

interface RoleTopicConfig {
  [roleName: string]: string[];
}

const themeColors = [
  { name: 'Roxo', value: 'purple', gradient: 'from-purple-600 to-purple-800' },
  { name: 'Azul', value: 'blue', gradient: 'from-blue-600 to-blue-800' },
  { name: 'Verde', value: 'green', gradient: 'from-emerald-600 to-emerald-800' },
  { name: 'Vermelho', value: 'red', gradient: 'from-red-600 to-red-800' },
  { name: 'Laranja', value: 'orange', gradient: 'from-orange-600 to-orange-800' },
  { name: 'Rosa', value: 'pink', gradient: 'from-pink-600 to-pink-800' },
];

const aiProviders = [
  { 
    name: 'Lovable AI (Gratuito)', 
    value: 'lovable', 
    description: 'Usa a API gratuita do Lovable AI',
    requiresApiKey: false 
  },
  { 
    name: 'OpenAI', 
    value: 'openai', 
    description: 'Requer API Key da OpenAI',
    requiresApiKey: true 
  },
  { 
    name: 'Groq', 
    value: 'groq', 
    description: 'Requer API Key da Groq',
    requiresApiKey: true 
  },
];

const modelsByProvider: Record<string, { name: string; value: string; description: string }[]> = {
  lovable: [
    { name: 'Gemini 2.5 Flash (Recomendado)', value: 'google/gemini-2.5-flash', description: 'Rápido e eficiente' },
    { name: 'Gemini 2.5 Pro', value: 'google/gemini-2.5-pro', description: 'Mais poderoso, melhor para tarefas complexas' },
    { name: 'Gemini 2.5 Flash Lite', value: 'google/gemini-2.5-flash-lite', description: 'Mais rápido e barato' },
    { name: 'GPT-5', value: 'openai/gpt-5', description: 'OpenAI GPT-5, muito poderoso' },
    { name: 'GPT-5 Mini', value: 'openai/gpt-5-mini', description: 'GPT-5 mais rápido e barato' },
    { name: 'GPT-5 Nano', value: 'openai/gpt-5-nano', description: 'GPT-5 mais leve e econômico' },
  ],
  openai: [
    { name: 'GPT-4o Mini (Recomendado)', value: 'gpt-4o-mini', description: 'Rápido e econômico' },
    { name: 'GPT-4o', value: 'gpt-4o', description: 'Mais poderoso, melhor qualidade' },
    { name: 'GPT-4 Turbo', value: 'gpt-4-turbo', description: 'Alto desempenho' },
    { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', description: 'Mais econômico' },
  ],
  groq: [
    { name: 'Llama 3.3 70B (Recomendado)', value: 'llama-3.3-70b-versatile', description: 'Muito rápido e poderoso' },
    { name: 'Llama 3.1 8B', value: 'llama-3.1-8b-instant', description: 'Ultra rápido' },
    { name: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768', description: 'Bom equilíbrio' },
    { name: 'Gemma2 9B', value: 'gemma2-9b-it', description: 'Compacto e eficiente' },
  ],
};

interface AITopic {
  key: string;
  name: string;
  description: string;
  category: string;
}

const AdminChatConfig = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [config, setConfig] = useState({
    chat_enabled: false,
    chat_name: 'Lyra',
    chat_welcome_message: 'Olá! Sou a Lyra, sua assistente virtual. Como posso ajudar?',
    chat_placeholder: 'Digite sua mensagem...',
    chat_response_delay: '0',
    chat_theme_color: 'purple',
    chat_operating_hours_enabled: false,
    chat_operating_hours_start: '08:00',
    chat_operating_hours_end: '18:00',
    chat_offline_message: 'Estamos fora do horário de atendimento. Retornaremos em breve!',
    chat_ai_prompt: `Você é a Lyra, uma assistente virtual da Astros Comunicação Digital. 
Você é amigável, profissional e sempre disposta a ajudar.

Sobre o sistema:
- Este é um sistema de cadastro e gerenciamento de clientes
- Funcionalidades: Cadastrar, Consultar, Atualizar e Excluir clientes
- Campos dos clientes: Nome, Número WhatsApp, Produto, Data de Renovação, Email, CPF/CNPJ, Plano e Valor

Instruções:
- Responda sempre em português brasileiro
- Seja concisa mas útil
- Se não souber a resposta, indique que o usuário pode entrar em contato com o suporte
- Mantenha um tom amigável e profissional`,
    chat_quick_replies: '[]',
    chat_ai_provider: 'lovable',
    chat_ai_model: 'google/gemini-2.5-flash',
    chat_openai_api_key: '',
    chat_groq_api_key: '',
    // Role-based access settings
    chat_role_restriction_enabled: false,
    chat_role_topics: '{}',
    chat_denial_message: 'Desculpe, não tenho permissão para responder sobre esse assunto com base no seu perfil de acesso. Entre em contato com um administrador se precisar de mais informações.',
  });

  const [quickReplies, setQuickReplies] = useState<{ trigger: string; response: string }[]>([]);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [roleTopics, setRoleTopics] = useState<RoleTopicConfig>({});

  // Fetch custom roles
  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles-chat-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_roles')
        .select('id, name, display_name')
        .order('name');
      if (error) throw error;
      return data as CustomRole[];
    },
  });

  // Fetch system permissions as AI topics
  const { data: aiTopics = [] } = useQuery({
    queryKey: ['system-permissions-topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_permissions')
        .select('key, name, description, category')
        .order('category, name');
      if (error) throw error;
      
      // Helper to capitalize category names
      const formatCategoryName = (category: string): string => {
        const categoryNames: Record<string, string> = {
          'admin': 'Administração',
          'clientes': 'Clientes',
          'dashboard': 'Dashboard',
          'divulgador': 'Divulgador',
          'cobranca': 'Cobrança',
          'usuarios': 'Usuários',
          'permissoes': 'Permissões',
          'webhooks': 'Webhooks',
          'api': 'API REST',
          'logs': 'Logs',
          'configuracoes': 'Configurações',
        };
        return categoryNames[category.toLowerCase()] || 
          category.charAt(0).toUpperCase() + category.slice(1);
      };
      
      // Group by category and return unique categories as topics
      const categoryMap = new Map<string, AITopic>();
      data.forEach(permission => {
        const categoryKey = permission.category.toLowerCase().replace(/\s+/g, '_');
        if (!categoryMap.has(categoryKey)) {
          categoryMap.set(categoryKey, {
            key: categoryKey,
            name: formatCategoryName(permission.category),
            description: `Permissões relacionadas a ${formatCategoryName(permission.category)}`,
            category: permission.category
          });
        }
      });
      
      return Array.from(categoryMap.values());
    },
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('billing_config')
        .select('config_key, config_value')
        .like('config_key', 'chat_%');

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
          chat_response_delay: configMap.chat_response_delay || '0',
          chat_theme_color: configMap.chat_theme_color || 'purple',
          chat_operating_hours_enabled: configMap.chat_operating_hours_enabled === 'true',
          chat_operating_hours_start: configMap.chat_operating_hours_start || '08:00',
          chat_operating_hours_end: configMap.chat_operating_hours_end || '18:00',
          chat_offline_message: configMap.chat_offline_message || 'Estamos fora do horário de atendimento. Retornaremos em breve!',
          chat_ai_prompt: configMap.chat_ai_prompt || config.chat_ai_prompt,
          chat_quick_replies: configMap.chat_quick_replies || '[]',
          chat_ai_provider: configMap.chat_ai_provider || 'lovable',
          chat_ai_model: configMap.chat_ai_model || 'google/gemini-2.5-flash',
          chat_openai_api_key: configMap.chat_openai_api_key || '',
          chat_groq_api_key: configMap.chat_groq_api_key || '',
          chat_role_restriction_enabled: configMap.chat_role_restriction_enabled === 'true',
          chat_role_topics: configMap.chat_role_topics || '{}',
          chat_denial_message: configMap.chat_denial_message || 'Desculpe, não tenho permissão para responder sobre esse assunto com base no seu perfil de acesso. Entre em contato com um administrador se precisar de mais informações.',
        });

        try {
          const parsedReplies = JSON.parse(configMap.chat_quick_replies || '[]');
          setQuickReplies(parsedReplies);
        } catch {
          setQuickReplies([]);
        }

        try {
          const parsedTopics = JSON.parse(configMap.chat_role_topics || '{}');
          setRoleTopics(parsedTopics);
        } catch {
          setRoleTopics({});
        }
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
        { config_key: 'chat_response_delay', config_value: config.chat_response_delay },
        { config_key: 'chat_theme_color', config_value: config.chat_theme_color },
        { config_key: 'chat_operating_hours_enabled', config_value: config.chat_operating_hours_enabled ? 'true' : 'false' },
        { config_key: 'chat_operating_hours_start', config_value: config.chat_operating_hours_start },
        { config_key: 'chat_operating_hours_end', config_value: config.chat_operating_hours_end },
        { config_key: 'chat_offline_message', config_value: config.chat_offline_message },
        { config_key: 'chat_ai_prompt', config_value: config.chat_ai_prompt },
        { config_key: 'chat_quick_replies', config_value: JSON.stringify(quickReplies) },
        { config_key: 'chat_ai_provider', config_value: config.chat_ai_provider },
        { config_key: 'chat_ai_model', config_value: config.chat_ai_model },
        { config_key: 'chat_openai_api_key', config_value: config.chat_openai_api_key },
        { config_key: 'chat_groq_api_key', config_value: config.chat_groq_api_key },
        { config_key: 'chat_role_restriction_enabled', config_value: config.chat_role_restriction_enabled ? 'true' : 'false' },
        { config_key: 'chat_role_topics', config_value: JSON.stringify(roleTopics) },
        { config_key: 'chat_denial_message', config_value: config.chat_denial_message },
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

  const toggleRoleTopic = (roleName: string, topicKey: string) => {
    setRoleTopics(prev => {
      const current = prev[roleName] || [];
      const newTopics = current.includes(topicKey)
        ? current.filter(t => t !== topicKey)
        : [...current, topicKey];
      return { ...prev, [roleName]: newTopics };
    });
  };

  const selectAllTopicsForRole = (roleName: string) => {
    setRoleTopics(prev => ({
      ...prev,
      [roleName]: aiTopics.map(t => t.key)
    }));
  };

  const clearAllTopicsForRole = (roleName: string) => {
    setRoleTopics(prev => ({
      ...prev,
      [roleName]: []
    }));
  };

  const addQuickReply = () => {
    setQuickReplies([...quickReplies, { trigger: '', response: '' }]);
  };

  const removeQuickReply = (index: number) => {
    setQuickReplies(quickReplies.filter((_, i) => i !== index));
  };

  const updateQuickReply = (index: number, field: 'trigger' | 'response', value: string) => {
    const updated = [...quickReplies];
    updated[index][field] = value;
    setQuickReplies(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedTheme = themeColors.find(t => t.value === config.chat_theme_color) || themeColors[0];

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
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${selectedTheme.gradient} flex items-center justify-center`}>
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t('chatConfig.title')} ({config.chat_name})</h1>
                <p className="text-sm text-muted-foreground">{t('chatConfig.subtitle')}</p>
              </div>
            </div>
          </div>
          <Button onClick={saveConfig} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="geral" className="gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">{t('chatConfig.general')}</span>
            </TabsTrigger>
            <TabsTrigger value="aparencia" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">{t('chatConfig.appearance')}</span>
            </TabsTrigger>
            <TabsTrigger value="horario" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">{t('chatConfig.schedule')}</span>
            </TabsTrigger>
            <TabsTrigger value="respostas" className="gap-2">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">{t('chatConfig.responses')}</span>
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">{t('chatConfig.ai')}</span>
            </TabsTrigger>
            <TabsTrigger value="permissoes" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t('chatConfig.permissions')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Geral */}
          <TabsContent value="geral" className="space-y-6">
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
                      <CardDescription>Customizar nome e textos</CardDescription>
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
                      Tempo de espera antes de exibir resposta. 0 = instantâneo.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab Aparência */}
          <TabsContent value="aparencia" className="space-y-6">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                    <Palette className="h-5 w-5 text-pink-500" />
                  </div>
                  <div>
                    <CardTitle>Cor do Tema</CardTitle>
                    <CardDescription>Escolha a cor principal do chat</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {themeColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setConfig({ ...config, chat_theme_color: color.value })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        config.chat_theme_color === color.value 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-border/40 hover:border-border'
                      }`}
                    >
                      <div className={`h-12 w-full rounded-lg bg-gradient-to-br ${color.gradient} mb-2`} />
                      <p className="text-sm font-medium text-center">{color.name}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Veja como ficará o cabeçalho do chat</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`bg-gradient-to-r ${selectedTheme.gradient} p-4 rounded-xl`}>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    {config.chat_name} - Assistente Virtual
                  </h3>
                  <p className="text-sm text-white/80">Como posso ajudar?</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Horário */}
          <TabsContent value="horario" className="space-y-6">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle>Horário de Funcionamento</CardTitle>
                    <CardDescription>Configure quando o chat estará disponível</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="hours-enabled" className="font-medium">Restringir Horário</Label>
                    <p className="text-sm text-muted-foreground">Limitar atendimento a horários específicos</p>
                  </div>
                  <Switch
                    id="hours-enabled"
                    checked={config.chat_operating_hours_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, chat_operating_hours_enabled: checked })}
                  />
                </div>

                {config.chat_operating_hours_enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="hours-start">Horário de Início</Label>
                        <Input
                          id="hours-start"
                          type="time"
                          value={config.chat_operating_hours_start}
                          onChange={(e) => setConfig({ ...config, chat_operating_hours_start: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hours-end">Horário de Término</Label>
                        <Input
                          id="hours-end"
                          type="time"
                          value={config.chat_operating_hours_end}
                          onChange={(e) => setConfig({ ...config, chat_operating_hours_end: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="offline-message">Mensagem Fora do Horário</Label>
                      <Textarea
                        id="offline-message"
                        value={config.chat_offline_message}
                        onChange={(e) => setConfig({ ...config, chat_offline_message: e.target.value })}
                        placeholder="Estamos fora do horário de atendimento..."
                        rows={2}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Respostas */}
          <TabsContent value="respostas" className="space-y-6">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <ListChecks className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <CardTitle>Respostas Automáticas</CardTitle>
                      <CardDescription>Configure respostas predefinidas para palavras-chave</CardDescription>
                    </div>
                  </div>
                  <Button onClick={addQuickReply} variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {quickReplies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma resposta automática configurada. Clique em "Adicionar" para criar.
                  </p>
                ) : (
                  quickReplies.map((reply, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 p-4 rounded-lg border border-border/40 bg-background/50">
                      <div className="space-y-2">
                        <Label>Palavra-chave / Gatilho</Label>
                        <Input
                          value={reply.trigger}
                          onChange={(e) => updateQuickReply(index, 'trigger', e.target.value)}
                          placeholder="Ex: preço, horário, contato"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Resposta Automática</Label>
                        <Textarea
                          value={reply.response}
                          onChange={(e) => updateQuickReply(index, 'response', e.target.value)}
                          placeholder="Resposta que será enviada quando o gatilho for detectado..."
                          rows={2}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuickReply(index)}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <p className="text-xs text-muted-foreground">
                  Se a mensagem do usuário contiver a palavra-chave, a resposta automática será enviada antes de consultar a IA.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab IA */}
          <TabsContent value="ia" className="space-y-6">
            {/* Provedor */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <CardTitle>Provedor de IA</CardTitle>
                    <CardDescription>Escolha o serviço de IA para gerar respostas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {aiProviders.map((provider) => (
                    <button
                      key={provider.value}
                      onClick={() => {
                        const defaultModel = modelsByProvider[provider.value]?.[0]?.value || 'google/gemini-2.5-flash';
                        setConfig({ ...config, chat_ai_provider: provider.value, chat_ai_model: defaultModel });
                      }}
                      className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                        config.chat_ai_provider === provider.value 
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
                          : 'border-border/40 hover:border-border bg-background/50'
                      }`}
                    >
                      {config.chat_ai_provider === provider.value && (
                        <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-primary" />
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-foreground">{provider.name}</p>
                        {!provider.requiresApiKey && (
                          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">
                            Gratuito
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API Keys - show only for providers that require them */}
            {config.chat_ai_provider === 'openai' && (
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm border-orange-500/30">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <Key className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle>API Key da OpenAI</CardTitle>
                      <CardDescription>Configure sua chave de API da OpenAI</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key</Label>
                    <div className="relative">
                      <Input
                        id="openai-key"
                        type={showOpenAIKey ? 'text' : 'password'}
                        value={config.chat_openai_api_key}
                        onChange={(e) => setConfig({ ...config, chat_openai_api_key: e.target.value })}
                        placeholder="sk-..."
                        className="pr-10 font-mono"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      >
                        {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Obtenha sua API Key em{' '}
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        platform.openai.com/api-keys
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {config.chat_ai_provider === 'groq' && (
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm border-blue-500/30">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Key className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle>API Key da Groq</CardTitle>
                      <CardDescription>Configure sua chave de API da Groq</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groq-key">Groq API Key</Label>
                    <div className="relative">
                      <Input
                        id="groq-key"
                        type={showGroqKey ? 'text' : 'password'}
                        value={config.chat_groq_api_key}
                        onChange={(e) => setConfig({ ...config, chat_groq_api_key: e.target.value })}
                        placeholder="gsk_..."
                        className="pr-10 font-mono"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowGroqKey(!showGroqKey)}
                      >
                        {showGroqKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Obtenha sua API Key em{' '}
                      <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        console.groq.com/keys
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Modelo */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <CardTitle>Modelo de IA</CardTitle>
                    <CardDescription>Escolha qual modelo será usado para gerar respostas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(modelsByProvider[config.chat_ai_provider] || []).map((model) => (
                    <button
                      key={model.value}
                      onClick={() => setConfig({ ...config, chat_ai_model: model.value })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        config.chat_ai_model === model.value 
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
                          : 'border-border/40 hover:border-border bg-background/50'
                      }`}
                    >
                      <p className="font-medium text-foreground">{model.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
                      <p className="text-xs text-primary/70 mt-2 font-mono">{model.value}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Provedor: <span className="font-mono text-primary">{aiProviders.find(p => p.value === config.chat_ai_provider)?.name}</span>
                  {' | '}Modelo: <span className="font-mono text-primary">{config.chat_ai_model}</span>
                </p>
              </CardContent>
            </Card>

            {/* Prompt */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <CardTitle>Prompt do Sistema</CardTitle>
                    <CardDescription>Personalize o comportamento do assistente</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-prompt">Instruções para a IA</Label>
                  <Textarea
                    id="ai-prompt"
                    value={config.chat_ai_prompt}
                    onChange={(e) => setConfig({ ...config, chat_ai_prompt: e.target.value })}
                    placeholder="Defina as instruções e contexto para a IA..."
                    rows={15}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este prompt define a personalidade, conhecimento e comportamento do assistente. 
                    Seja específico sobre o contexto do sistema, tom de voz e limitações.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Permissões */}
          <TabsContent value="permissoes" className="space-y-6">
            {/* Toggle Restrição */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle>Controle de Acesso por Role</CardTitle>
                    <CardDescription>Restrinja as respostas da IA com base no cargo do usuário</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="role-restriction" className="font-medium">Habilitar Restrição por Role</Label>
                    <p className="text-sm text-muted-foreground">A IA só responderá sobre assuntos permitidos para o cargo do usuário</p>
                  </div>
                  <Switch
                    id="role-restriction"
                    checked={config.chat_role_restriction_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, chat_role_restriction_enabled: checked })}
                  />
                </div>

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-200">
                    <p className="font-medium">Como funciona:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-blue-300/80">
                      <li>Administradores sempre têm acesso total</li>
                      <li>Configure quais tópicos cada role pode acessar</li>
                      <li>Perguntas fora do escopo exibem mensagem de negação</li>
                      <li>O Guia do Usuário também respeita essas permissões</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mensagem de Negação */}
            {config.chat_role_restriction_enabled && (
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <CardTitle>Mensagem de Negação</CardTitle>
                      <CardDescription>Resposta quando o usuário pergunta algo fora do seu escopo</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={config.chat_denial_message}
                    onChange={(e) => setConfig({ ...config, chat_denial_message: e.target.value })}
                    placeholder="Desculpe, não tenho permissão para responder sobre esse assunto..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            )}

            {/* Matriz de Permissões */}
            {config.chat_role_restriction_enabled && (
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <ListChecks className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle>Tópicos por Role</CardTitle>
                      <CardDescription>Selecione quais assuntos cada role pode perguntar à IA</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {customRoles.filter(r => r.name !== 'admin').map(role => (
                      <div key={role.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{role.display_name}</Badge>
                            <span className="text-xs text-muted-foreground">
                              ({(roleTopics[role.name] || []).length} de {aiTopics.length} tópicos)
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => selectAllTopicsForRole(role.name)}
                              className="text-xs"
                            >
                              Marcar todos
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => clearAllTopicsForRole(role.name)}
                              className="text-xs text-muted-foreground"
                            >
                              Limpar
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                          {aiTopics.map(topic => (
                            <div
                              key={topic.key}
                              className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                (roleTopics[role.name] || []).includes(topic.key)
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border/40 hover:border-border'
                              }`}
                              onClick={() => toggleRoleTopic(role.name, topic.key)}
                            >
                              <Checkbox
                                checked={(roleTopics[role.name] || []).includes(topic.key)}
                                className="pointer-events-none"
                              />
                              <span className="text-sm">{topic.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {customRoles.filter(r => r.name !== 'admin').length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma role customizada encontrada. Crie roles em Permissões para configurar acesso.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminChatConfig;
