import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Megaphone,
  Settings,
  Target,
  Users,
  MessageSquare,
  Sparkles,
  UserMinus,
  BarChart3,
  Plus,
  Save,
  RefreshCw,
  Wifi,
  WifiOff,
  Send,
  Calendar,
  Clock,
  Trash2,
  Edit,
  Eye,
  Download,
  Upload,
  Image,
  Video,
  FileText,
  Music,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  Pause,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DivulgadorConfig {
  id: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
  auto_create_groups: boolean;
  min_empty_groups: number;
  max_participants_per_group: number;
  welcome_message_enabled: boolean;
  mention_all_enabled: boolean;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  group_prefix: string;
  max_participants: number;
  created_at: string;
}

interface Group {
  id: string;
  group_id: string;
  name: string;
  campaign_id: string | null;
  participant_count: number;
  max_participants: number;
  status: string;
  created_at: string;
}

interface ScheduledMessage {
  id: string;
  campaign_id: string | null;
  content: string;
  media_type: string | null;
  media_url: string | null;
  scheduled_at: string;
  status: string;
  mention_all: boolean;
}

interface Participant {
  id: string;
  phone: string;
  name: string | null;
  group_id: string;
  joined_at: string;
  status: string;
}

export default function AdminDivulgador() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('config');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Fetch config
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['divulgador-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_config')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as DivulgadorConfig | null;
    },
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['divulgador-campaigns'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Campaign[];
    },
  });

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['divulgador-groups'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_groups')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Group[];
    },
  });

  // Fetch scheduled messages
  const { data: scheduledMessages = [] } = useQuery({
    queryKey: ['divulgador-messages'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_scheduled_messages')
        .select('*')
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ScheduledMessage[];
    },
  });

  // Fetch participants
  const { data: participants = [] } = useQuery({
    queryKey: ['divulgador-participants'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_participants')
        .select('*')
        .order('joined_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return (data || []) as Participant[];
    },
  });

  // Fetch logs for reports
  const { data: logs = [] } = useQuery({
    queryKey: ['divulgador-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch welcome templates
  const { data: welcomeTemplates = [] } = useQuery({
    queryKey: ['divulgador-welcome-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_welcome_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Config state
  const [configForm, setConfigForm] = useState({
    api_url: '',
    api_key: '',
    instance_name: '',
    auto_create_groups: false,
    min_empty_groups: 3,
    max_participants_per_group: 250,
    welcome_message_enabled: false,
    mention_all_enabled: false,
  });

  // Update config form when data loads
  useState(() => {
    if (config) {
      setConfigForm({
        api_url: config.api_url || '',
        api_key: config.api_key || '',
        instance_name: config.instance_name || '',
        auto_create_groups: config.auto_create_groups || false,
        min_empty_groups: config.min_empty_groups || 3,
        max_participants_per_group: config.max_participants_per_group || 250,
        welcome_message_enabled: config.welcome_message_enabled || false,
        mention_all_enabled: config.mention_all_enabled || false,
      });
    }
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (formData: typeof configForm) => {
      const { data: existingConfig } = await (supabase as any)
        .from('divulgador_config')
        .select('id')
        .single();

      if (existingConfig) {
        const { error } = await (supabase as any)
          .from('divulgador_config')
          .update({
            api_url: formData.api_url,
            api_key: formData.api_key,
            instance_name: formData.instance_name,
            auto_create_groups: formData.auto_create_groups,
            min_empty_groups: formData.min_empty_groups,
            max_participants_per_group: formData.max_participants_per_group,
            welcome_message_enabled: formData.welcome_message_enabled,
            mention_all_enabled: formData.mention_all_enabled,
          })
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('divulgador_config')
          .insert([formData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-config'] });
      toast.success('Configuração salva com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar configuração: ' + error.message);
    },
  });

  // Test connection
  const testConnection = async () => {
    if (!configForm.api_url || !configForm.api_key || !configForm.instance_name) {
      toast.error('Preencha todos os campos de configuração');
      return;
    }

    setIsTestingConnection(true);
    try {
      const response = await fetch(`${configForm.api_url}/instance/connectionState/${configForm.instance_name}`, {
        headers: {
          'apikey': configForm.api_key,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.state === 'open') {
          toast.success('Conexão estabelecida com sucesso!');
          // Update connection status
          await (supabase as any)
            .from('divulgador_config')
            .update({ is_connected: true })
            .eq('instance_name', configForm.instance_name);
          queryClient.invalidateQueries({ queryKey: ['divulgador-config'] });
        } else {
          toast.warning(`Status da instância: ${data.state}`);
        }
      } else {
        toast.error('Falha na conexão. Verifique as credenciais.');
      }
    } catch (error: any) {
      toast.error('Erro ao testar conexão: ' + error.message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    group_prefix: '',
    max_participants: 250,
  });

  // Create/Update campaign mutation
  const saveCampaignMutation = useMutation({
    mutationFn: async (formData: typeof campaignForm) => {
      if (editingCampaign) {
        const { error } = await (supabase as any)
          .from('divulgador_campaigns')
          .update(formData)
          .eq('id', editingCampaign.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('divulgador_campaigns')
          .insert([{ ...formData, status: 'active' }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-campaigns'] });
      toast.success(editingCampaign ? 'Campanha atualizada!' : 'Campanha criada!');
      setIsCampaignDialogOpen(false);
      setEditingCampaign(null);
      setCampaignForm({ name: '', description: '', group_prefix: '', max_participants: 250 });
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('divulgador_campaigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-campaigns'] });
      toast.success('Campanha excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  // Message form state
  const [messageForm, setMessageForm] = useState({
    campaign_id: '',
    content: '',
    media_type: '',
    scheduled_at: '',
    mention_all: false,
  });

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (formData: typeof messageForm) => {
      const { error } = await (supabase as any)
        .from('divulgador_scheduled_messages')
        .insert([{
          ...formData,
          campaign_id: formData.campaign_id || null,
          media_type: formData.media_type || null,
          status: 'pending',
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem agendada!');
      setIsMessageDialogOpen(false);
      setMessageForm({ campaign_id: '', content: '', media_type: '', scheduled_at: '', mention_all: false });
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('divulgador_scheduled_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem removida!');
    },
  });

  // Welcome template form
  const [welcomeForm, setWelcomeForm] = useState({
    name: '',
    content: '',
    is_active: true,
  });

  // Save welcome template mutation
  const saveWelcomeMutation = useMutation({
    mutationFn: async (formData: typeof welcomeForm) => {
      const { error } = await (supabase as any)
        .from('divulgador_welcome_templates')
        .insert([formData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome-templates'] });
      toast.success('Template salvo!');
      setWelcomeForm({ name: '', content: '', is_active: true });
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  // Stats calculations
  const totalParticipants = participants.length;
  const totalGroups = groups.length;
  const activeGroups = groups.filter(g => g.status === 'active').length;
  const totalMessages = scheduledMessages.length;
  const pendingMessages = scheduledMessages.filter(m => m.status === 'pending').length;
  const successLogs = logs.filter((l: any) => l.status === 'success').length;
  const errorLogs = logs.filter((l: any) => l.status === 'error').length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20">
                <Megaphone className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Divulgador Interno</h1>
                <p className="text-sm text-muted-foreground">
                  Gerenciamento de grupos de WhatsApp
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {config?.is_connected ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                <WifiOff className="h-3 w-3 mr-1" />
                Desconectado
              </Badge>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/40">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalParticipants}</p>
                  <p className="text-xs text-muted-foreground">Participantes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeGroups}/{totalGroups}</p>
                  <p className="text-xs text-muted-foreground">Grupos Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingMessages}</p>
                  <p className="text-xs text-muted-foreground">Msg Agendadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <BarChart3 className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaigns.length}</p>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="config" className="gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Campanhas</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Grupos</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Mensagens</span>
            </TabsTrigger>
            <TabsTrigger value="welcome" className="gap-1">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Boas-vindas</span>
            </TabsTrigger>
            <TabsTrigger value="participants" className="gap-1">
              <UserMinus className="h-4 w-4" />
              <span className="hidden sm:inline">Participantes</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
          </TabsList>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-orange-500" />
                  Configuração da Instância WhatsApp
                </CardTitle>
                <CardDescription>
                  Configure a instância exclusiva do Divulgador (independente de outros módulos)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>URL da API Evolution</Label>
                    <Input
                      placeholder="https://api.evolution.com.br"
                      value={configForm.api_url}
                      onChange={(e) => setConfigForm({ ...configForm, api_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder="Sua chave de API"
                      value={configForm.api_key}
                      onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input
                      placeholder="divulgador-instance"
                      value={configForm.instance_name}
                      onChange={(e) => setConfigForm({ ...configForm, instance_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={testConnection}
                    disabled={isTestingConnection}
                  >
                    {isTestingConnection ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Testar Conexão
                  </Button>
                  <Button
                    onClick={() => saveConfigMutation.mutate(configForm)}
                    disabled={saveConfigMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Configuração
                  </Button>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-4">Automação de Grupos</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium">Criação Automática de Grupos</p>
                        <p className="text-sm text-muted-foreground">
                          Criar novos grupos quando atingir limite
                        </p>
                      </div>
                      <Switch
                        checked={configForm.auto_create_groups}
                        onCheckedChange={(checked) =>
                          setConfigForm({ ...configForm, auto_create_groups: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium">Menção Automática</p>
                        <p className="text-sm text-muted-foreground">
                          Mencionar todos ao enviar mensagens
                        </p>
                      </div>
                      <Switch
                        checked={configForm.mention_all_enabled}
                        onCheckedChange={(checked) =>
                          setConfigForm({ ...configForm, mention_all_enabled: checked })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mínimo de Grupos Vazios</Label>
                      <Input
                        type="number"
                        min={1}
                        value={configForm.min_empty_groups}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, min_empty_groups: parseInt(e.target.value) || 3 })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Sistema mantém essa quantidade de grupos disponíveis
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Máx. Participantes por Grupo</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1024}
                        value={configForm.max_participants_per_group}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, max_participants_per_group: parseInt(e.target.value) || 250 })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Limite máximo do WhatsApp: 1024
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Campanhas
                  </CardTitle>
                  <CardDescription>
                    Organize grupos por campanhas para envio segmentado
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCampaignDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Campanha
                </Button>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma campanha criada</p>
                    <p className="text-sm">Clique em "Nova Campanha" para começar</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {campaigns.map((campaign) => {
                      const campaignGroups = groups.filter(g => g.campaign_id === campaign.id);
                      const campaignParticipants = campaignGroups.reduce((sum, g) => sum + g.participant_count, 0);
                      
                      return (
                        <Card key={campaign.id} className="border-border/40">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{campaign.name}</CardTitle>
                              <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                                {campaign.status === 'active' ? 'Ativa' : 'Pausada'}
                              </Badge>
                            </div>
                            <CardDescription className="text-xs">
                              {campaign.description || 'Sem descrição'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-muted-foreground">Grupos</p>
                                <p className="font-semibold">{campaignGroups.length}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Participantes</p>
                                <p className="font-semibold">{campaignParticipants}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setEditingCampaign(campaign);
                                  setCampaignForm({
                                    name: campaign.name,
                                    description: campaign.description || '',
                                    group_prefix: campaign.group_prefix,
                                    max_participants: campaign.max_participants,
                                  });
                                  setIsCampaignDialogOpen(true);
                                }}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => {
                                  if (confirm('Excluir esta campanha?')) {
                                    deleteCampaignMutation.mutate(campaign.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    Grupos de WhatsApp
                  </CardTitle>
                  <CardDescription>
                    Gerencie todos os grupos vinculados ao Divulgador
                  </CardDescription>
                </div>
                <Button onClick={() => setIsGroupDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Grupo
                </Button>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum grupo cadastrado</p>
                    <p className="text-sm">Crie grupos via API Evolution</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Participantes</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groups.map((group) => {
                          const campaign = campaigns.find(c => c.id === group.campaign_id);
                          return (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.name}</TableCell>
                              <TableCell>
                                {campaign ? (
                                  <Badge variant="outline">{campaign.name}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{group.participant_count}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-muted-foreground">{group.max_participants}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
                                  {group.status === 'active' ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(group.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                    Mensagens Agendadas
                  </CardTitle>
                  <CardDescription>
                    Agende mensagens para todos os grupos ou campanhas específicas
                  </CardDescription>
                </div>
                <Button onClick={() => setIsMessageDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Mensagem
                </Button>
              </CardHeader>
              <CardContent>
                {scheduledMessages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mensagem agendada</p>
                    <p className="text-sm">Agende mensagens para envio automático</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {scheduledMessages.map((message) => {
                        const campaign = campaigns.find(c => c.id === message.campaign_id);
                        const isPast = new Date(message.scheduled_at) < new Date();
                        
                        return (
                          <div
                            key={message.id}
                            className="p-4 rounded-lg border border-border/40 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  message.status === 'sent' ? 'default' :
                                  message.status === 'pending' ? 'secondary' : 'destructive'
                                }>
                                  {message.status === 'sent' ? 'Enviada' :
                                   message.status === 'pending' ? 'Pendente' : 'Erro'}
                                </Badge>
                                {campaign && (
                                  <Badge variant="outline">{campaign.name}</Badge>
                                )}
                                {message.mention_all && (
                                  <Badge variant="outline" className="text-blue-500">
                                    @todos
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(message.scheduled_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </div>
                            </div>
                            <p className="text-sm line-clamp-2">{message.content}</p>
                            {message.media_type && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {message.media_type === 'image' && <Image className="h-3 w-3" />}
                                {message.media_type === 'video' && <Video className="h-3 w-3" />}
                                {message.media_type === 'audio' && <Music className="h-3 w-3" />}
                                {message.media_type === 'document' && <FileText className="h-3 w-3" />}
                                <span>{message.media_type}</span>
                              </div>
                            )}
                            <div className="flex justify-end gap-2">
                              {message.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500"
                                  onClick={() => deleteMessageMutation.mutate(message.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Welcome Tab */}
          <TabsContent value="welcome" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  Mensagem de Boas-vindas
                </CardTitle>
                <CardDescription>
                  Configure mensagem privada automática para novos participantes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Enviar Boas-vindas Automáticas</p>
                    <p className="text-sm text-muted-foreground">
                      Mensagem privada quando alguém entra em um grupo
                    </p>
                  </div>
                  <Switch
                    checked={configForm.welcome_message_enabled}
                    onCheckedChange={(checked) =>
                      setConfigForm({ ...configForm, welcome_message_enabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold">Templates de Boas-vindas</h3>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4 p-4 rounded-lg border">
                      <div className="space-y-2">
                        <Label>Nome do Template</Label>
                        <Input
                          placeholder="Ex: Boas-vindas Padrão"
                          value={welcomeForm.name}
                          onChange={(e) => setWelcomeForm({ ...welcomeForm, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mensagem</Label>
                        <Textarea
                          placeholder="Olá {nome}! Seja bem-vindo(a) ao grupo {grupo}..."
                          rows={4}
                          value={welcomeForm.content}
                          onChange={(e) => setWelcomeForm({ ...welcomeForm, content: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {'{nome}'} para nome do participante e {'{grupo}'} para nome do grupo
                        </p>
                      </div>
                      <Button
                        onClick={() => saveWelcomeMutation.mutate(welcomeForm)}
                        disabled={!welcomeForm.name || !welcomeForm.content}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Template
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Templates Salvos</Label>
                      {welcomeTemplates.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                          Nenhum template criado
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {welcomeTemplates.map((template: any) => (
                            <div
                              key={template.id}
                              className="p-3 rounded-lg border flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium">{template.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {template.content}
                                </p>
                              </div>
                              <Badge variant={template.is_active ? 'default' : 'secondary'}>
                                {template.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Participants Tab */}
          <TabsContent value="participants" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserMinus className="h-5 w-5 text-red-500" />
                    Controle de Participantes
                  </CardTitle>
                  <CardDescription>
                    Gerencie participantes de todos os grupos
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum participante registrado</p>
                    <p className="text-sm">Participantes aparecem quando grupos são sincronizados</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Entrada</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participants.map((participant) => {
                          const group = groups.find(g => g.id === participant.group_id);
                          return (
                            <TableRow key={participant.id}>
                              <TableCell className="font-mono">{participant.phone}</TableCell>
                              <TableCell>{participant.name || '-'}</TableCell>
                              <TableCell>
                                {group ? (
                                  <Badge variant="outline">{group.name}</Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={participant.status === 'active' ? 'default' : 'secondary'}>
                                  {participant.status === 'active' ? 'Ativo' : 'Removido'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(participant.joined_at), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{successLogs}</p>
                      <p className="text-xs text-muted-foreground">Envios com Sucesso</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{errorLogs}</p>
                      <p className="text-xs text-muted-foreground">Erros</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalParticipants}</p>
                      <p className="text-xs text-muted-foreground">Total Leads</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/40">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Send className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalMessages}</p>
                      <p className="text-xs text-muted-foreground">Total Mensagens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    Histórico de Atividades
                  </CardTitle>
                  <CardDescription>
                    Últimos 100 registros de atividade
                  </CardDescription>
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum registro de atividade</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ação</TableHead>
                          <TableHead>Detalhes</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.action}</TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                              {log.details || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                {log.status === 'success' ? 'Sucesso' : 'Erro'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Campaign Dialog */}
        <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
              </DialogTitle>
              <DialogDescription>
                Configure os detalhes da campanha de grupos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input
                  placeholder="Ex: Black Friday 2024"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o objetivo da campanha..."
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prefixo dos Grupos</Label>
                <Input
                  placeholder="Ex: VENDAS"
                  value={campaignForm.group_prefix}
                  onChange={(e) => setCampaignForm({ ...campaignForm, group_prefix: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Grupos serão nomeados: VENDAS-1, VENDAS-2, etc.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Máx. Participantes por Grupo</Label>
                <Input
                  type="number"
                  min={1}
                  max={1024}
                  value={campaignForm.max_participants}
                  onChange={(e) => setCampaignForm({ ...campaignForm, max_participants: parseInt(e.target.value) || 250 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCampaignDialogOpen(false);
                setEditingCampaign(null);
                setCampaignForm({ name: '', description: '', group_prefix: '', max_participants: 250 });
              }}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveCampaignMutation.mutate(campaignForm)}
                disabled={!campaignForm.name || saveCampaignMutation.isPending}
              >
                {saveCampaignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingCampaign ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Message Dialog */}
        <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agendar Mensagem</DialogTitle>
              <DialogDescription>
                Agende uma mensagem para envio em massa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Campanha (opcional)</Label>
                <Select
                  value={messageForm.campaign_id}
                  onValueChange={(value) => setMessageForm({ ...messageForm, campaign_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os grupos</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  placeholder="Digite sua mensagem..."
                  rows={5}
                  value={messageForm.content}
                  onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Mídia (opcional)</Label>
                  <Select
                    value={messageForm.media_type}
                    onValueChange={(value) => setMessageForm({ ...messageForm, media_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Apenas texto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Apenas texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data e Hora</Label>
                  <Input
                    type="datetime-local"
                    value={messageForm.scheduled_at}
                    onChange={(e) => setMessageForm({ ...messageForm, scheduled_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={messageForm.mention_all}
                  onCheckedChange={(checked) => setMessageForm({ ...messageForm, mention_all: checked })}
                />
                <Label>Mencionar todos os participantes (@todos)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsMessageDialogOpen(false);
                setMessageForm({ campaign_id: '', content: '', media_type: '', scheduled_at: '', mention_all: false });
              }}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMessageMutation.mutate(messageForm)}
                disabled={!messageForm.content || !messageForm.scheduled_at || createMessageMutation.isPending}
              >
                {createMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Agendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}