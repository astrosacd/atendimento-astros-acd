import { useState, useEffect } from 'react';
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
  ArrowLeft, Megaphone, Settings, Target, Users, MessageSquare, Sparkles,
  UserMinus, BarChart3, Plus, Save, RefreshCw, Wifi, WifiOff, Send,
  Calendar, Clock, Trash2, Edit, Eye, Download, Image, Video, FileText,
  Music, AlertCircle, CheckCircle2, Loader2, Copy, X
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminDivulgador() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('config');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);

  // Config form state
  const [instanceForm, setInstanceForm] = useState({
    instance_name: '',
    api_url: '',
    api_key: '',
  });

  // Fetch WhatsApp instance
  const { data: instance, isLoading: isLoadingInstance } = useQuery({
    queryKey: ['divulgador-instance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_whatsapp_instance')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Update form when instance loads
  useEffect(() => {
    if (instance) {
      setInstanceForm({
        instance_name: instance.instance_name || '',
        api_url: instance.api_url || '',
        api_key: instance.api_key || '',
      });
    }
  }, [instance]);

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['divulgador-campaigns'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['divulgador-groups'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_groups')
        .select('*, divulgador_campaigns(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['divulgador-messages'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_messages')
        .select('*, divulgador_campaigns(name)')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch participants
  const { data: participants = [] } = useQuery({
    queryKey: ['divulgador-participants'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_participants')
        .select('*, divulgador_groups(name)')
        .order('joined_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch welcome configs
  const { data: welcomeConfigs = [] } = useQuery({
    queryKey: ['divulgador-welcome'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_welcome_config')
        .select('*, divulgador_campaigns(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch send logs
  const { data: sendLogs = [] } = useQuery({
    queryKey: ['divulgador-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_send_logs')
        .select('*, divulgador_groups(name), divulgador_messages(content)')
        .order('sent_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Save instance mutation
  const saveInstanceMutation = useMutation({
    mutationFn: async (formData: typeof instanceForm) => {
      if (instance?.id) {
        const { error } = await (supabase as any)
          .from('divulgador_whatsapp_instance')
          .update(formData)
          .eq('id', instance.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('divulgador_whatsapp_instance')
          .insert([formData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-instance'] });
      toast.success('Instância salva com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  // Test connection
  const testConnection = async () => {
    if (!instanceForm.api_url || !instanceForm.api_key || !instanceForm.instance_name) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsTestingConnection(true);
    try {
      const response = await fetch(`${instanceForm.api_url}/instance/connectionState/${instanceForm.instance_name}`, {
        headers: { 'apikey': instanceForm.api_key },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.state === 'open') {
          toast.success('Conexão estabelecida!');
          if (instance?.id) {
            await (supabase as any)
              .from('divulgador_whatsapp_instance')
              .update({ is_connected: true, last_connected_at: new Date().toISOString() })
              .eq('id', instance.id);
            queryClient.invalidateQueries({ queryKey: ['divulgador-instance'] });
          }
        } else {
          toast.warning(`Status: ${data.state}`);
        }
      } else {
        toast.error('Falha na conexão');
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Campaign form
  const [campaignForm, setCampaignForm] = useState({
    name: '', description: '', min_empty_groups: 3, max_participants_per_group: 250, auto_create_groups: true,
  });

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
          .insert([formData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-campaigns'] });
      toast.success(editingCampaign ? 'Campanha atualizada!' : 'Campanha criada!');
      setIsCampaignDialogOpen(false);
      setEditingCampaign(null);
      setCampaignForm({ name: '', description: '', min_empty_groups: 3, max_participants_per_group: 250, auto_create_groups: true });
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('divulgador_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-campaigns'] });
      toast.success('Campanha excluída!');
    },
  });

  // Message form
  const [messageForm, setMessageForm] = useState({
    campaign_id: '', content: '', media_type: 'text', media_url: '', scheduled_at: '', mention_all: false,
  });

  const saveMessageMutation = useMutation({
    mutationFn: async (formData: typeof messageForm) => {
      const { error } = await (supabase as any)
        .from('divulgador_messages')
        .insert([{
          ...formData,
          campaign_id: formData.campaign_id || null,
          media_type: formData.media_type || 'text',
          status: 'pending',
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem agendada!');
      setIsMessageDialogOpen(false);
      setMessageForm({ campaign_id: '', content: '', media_type: 'text', media_url: '', scheduled_at: '', mention_all: false });
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('divulgador_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem removida!');
    },
  });

  // Welcome form
  const [welcomeForm, setWelcomeForm] = useState({
    campaign_id: '', message: '', is_active: true, delay_seconds: 5,
  });

  const saveWelcomeMutation = useMutation({
    mutationFn: async (formData: typeof welcomeForm) => {
      const { error } = await (supabase as any)
        .from('divulgador_welcome_config')
        .insert([{ ...formData, campaign_id: formData.campaign_id || null }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      toast.success('Boas-vindas salva!');
      setWelcomeForm({ campaign_id: '', message: '', is_active: true, delay_seconds: 5 });
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  // Stats
  const totalGroups = groups.length;
  const activeGroups = groups.filter((g: any) => g.is_active).length;
  const totalParticipants = participants.length;
  const pendingMessages = messages.filter((m: any) => m.status === 'pending').length;
  const sentMessages = messages.filter((m: any) => m.status === 'sent').length;
  const successLogs = sendLogs.filter((l: any) => l.status === 'sent').length;
  const errorLogs = sendLogs.filter((l: any) => l.status === 'failed').length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20">
                <Megaphone className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Divulgador Interno</h1>
                <p className="text-sm text-muted-foreground">Automação de grupos WhatsApp</p>
              </div>
            </div>
          </div>
          <Badge variant={instance?.is_connected ? "default" : "secondary"} className="gap-1.5">
            {instance?.is_connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {instance?.is_connected ? 'Conectado' : 'Desconectado'}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Target className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{campaigns.length}</p>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10"><Users className="h-4 w-4 text-info" /></div>
                <div>
                  <p className="text-2xl font-bold">{totalGroups}</p>
                  <p className="text-xs text-muted-foreground">Grupos ({activeGroups} ativos)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10"><MessageSquare className="h-4 w-4 text-emerald-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{messages.length}</p>
                  <p className="text-xs text-muted-foreground">Mensagens ({pendingMessages} pendentes)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10"><UserMinus className="h-4 w-4 text-violet-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{totalParticipants}</p>
                  <p className="text-xs text-muted-foreground">Participantes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 h-auto p-1">
            <TabsTrigger value="config" className="gap-2 py-2"><Settings className="h-4 w-4" /><span className="hidden sm:inline">Configuração</span></TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2 py-2"><Target className="h-4 w-4" /><span className="hidden sm:inline">Campanhas</span></TabsTrigger>
            <TabsTrigger value="groups" className="gap-2 py-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Grupos</span></TabsTrigger>
            <TabsTrigger value="messages" className="gap-2 py-2"><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Mensagens</span></TabsTrigger>
            <TabsTrigger value="welcome" className="gap-2 py-2"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Boas-vindas</span></TabsTrigger>
            <TabsTrigger value="participants" className="gap-2 py-2"><UserMinus className="h-4 w-4" /><span className="hidden sm:inline">Participantes</span></TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 py-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Relatórios</span></TabsTrigger>
          </TabsList>

          {/* CONFIGURAÇÃO */}
          <TabsContent value="config" className="space-y-6">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5 text-orange-500" />Instância WhatsApp</CardTitle>
                <CardDescription>Configure a instância Evolution API exclusiva para o Divulgador</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input value={instanceForm.instance_name} onChange={(e) => setInstanceForm({ ...instanceForm, instance_name: e.target.value })} placeholder="divulgador-instance" />
                  </div>
                  <div className="space-y-2">
                    <Label>API URL</Label>
                    <Input value={instanceForm.api_url} onChange={(e) => setInstanceForm({ ...instanceForm, api_url: e.target.value })} placeholder="https://api.evolution.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input type="password" value={instanceForm.api_key} onChange={(e) => setInstanceForm({ ...instanceForm, api_key: e.target.value })} placeholder="Sua API Key" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => saveInstanceMutation.mutate(instanceForm)} disabled={saveInstanceMutation.isPending}>
                    {saveInstanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={testConnection} disabled={isTestingConnection}>
                    {isTestingConnection ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Testar Conexão
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CAMPANHAS */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Campanhas</h2>
              <Button onClick={() => { setEditingCampaign(null); setCampaignForm({ name: '', description: '', min_empty_groups: 3, max_participants_per_group: 250, auto_create_groups: true }); setIsCampaignDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Nova Campanha
              </Button>
            </div>
            <div className="grid gap-4">
              {campaigns.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Nenhuma campanha criada</CardContent></Card>
              ) : (
                campaigns.map((campaign: any) => (
                  <Card key={campaign.id} className="border-border/40">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-orange-500/10"><Target className="h-5 w-5 text-orange-500" /></div>
                          <div>
                            <h3 className="font-semibold">{campaign.name}</h3>
                            <p className="text-sm text-muted-foreground">{campaign.description || 'Sem descrição'}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline">Min grupos vazios: {campaign.min_empty_groups}</Badge>
                              <Badge variant="outline">Max participantes: {campaign.max_participants_per_group}</Badge>
                              <Badge variant={campaign.is_active ? "default" : "secondary"}>{campaign.is_active ? 'Ativa' : 'Inativa'}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingCampaign(campaign); setCampaignForm({ name: campaign.name, description: campaign.description || '', min_empty_groups: campaign.min_empty_groups, max_participants_per_group: campaign.max_participants_per_group, auto_create_groups: campaign.auto_create_groups }); setIsCampaignDialogOpen(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteCampaignMutation.mutate(campaign.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* GRUPOS */}
          <TabsContent value="groups" className="space-y-6">
            <Card className="border-border/40">
              <CardHeader><CardTitle>Grupos Vinculados</CardTitle></CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum grupo criado ainda</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Participantes</TableHead>
                          <TableHead>Link</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groups.map((group: any) => (
                          <TableRow key={group.id}>
                            <TableCell className="font-medium">{group.name}</TableCell>
                            <TableCell>{group.divulgador_campaigns?.name || '-'}</TableCell>
                            <TableCell>{group.participant_count}</TableCell>
                            <TableCell>
                              {group.invite_link && (
                                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(group.invite_link); toast.success('Link copiado!'); }}>
                                  <Copy className="h-3 w-3 mr-1" />Copiar
                                </Button>
                              )}
                            </TableCell>
                            <TableCell><Badge variant={group.is_active ? "default" : "secondary"}>{group.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* MENSAGENS */}
          <TabsContent value="messages" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Mensagens Agendadas</h2>
              <Button onClick={() => setIsMessageDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Mensagem</Button>
            </div>
            <Card className="border-border/40">
              <CardContent className="pt-6">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma mensagem agendada</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Conteúdo</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Agendamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {messages.map((msg: any) => (
                          <TableRow key={msg.id}>
                            <TableCell className="max-w-[200px] truncate">{msg.content}</TableCell>
                            <TableCell>{msg.divulgador_campaigns?.name || 'Todos'}</TableCell>
                            <TableCell><Badge variant="outline">{msg.media_type || 'text'}</Badge></TableCell>
                            <TableCell>{msg.scheduled_at ? format(new Date(msg.scheduled_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}</TableCell>
                            <TableCell>
                              <Badge variant={msg.status === 'sent' ? 'default' : msg.status === 'failed' ? 'destructive' : 'secondary'}>
                                {msg.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMessageMutation.mutate(msg.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

          {/* BOAS-VINDAS */}
          <TabsContent value="welcome" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/40">
                <CardHeader><CardTitle>Nova Mensagem de Boas-vindas</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Campanha (opcional)</Label>
                    <Select value={welcomeForm.campaign_id} onValueChange={(v) => setWelcomeForm({ ...welcomeForm, campaign_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Todas as campanhas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas</SelectItem>
                        {campaigns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea rows={4} value={welcomeForm.message} onChange={(e) => setWelcomeForm({ ...welcomeForm, message: e.target.value })} placeholder="Olá! Bem-vindo ao grupo..." />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={welcomeForm.is_active} onCheckedChange={(c) => setWelcomeForm({ ...welcomeForm, is_active: c })} />
                      <Label>Ativo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label>Delay (seg):</Label>
                      <Input type="number" className="w-20" value={welcomeForm.delay_seconds} onChange={(e) => setWelcomeForm({ ...welcomeForm, delay_seconds: parseInt(e.target.value) || 5 })} />
                    </div>
                  </div>
                  <Button onClick={() => saveWelcomeMutation.mutate(welcomeForm)} disabled={saveWelcomeMutation.isPending || !welcomeForm.message}>
                    <Save className="h-4 w-4 mr-2" />Salvar
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardHeader><CardTitle>Templates Salvos</CardTitle></CardHeader>
                <CardContent>
                  {welcomeConfigs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhum template criado</p>
                  ) : (
                    <div className="space-y-3">
                      {welcomeConfigs.map((wc: any) => (
                        <div key={wc.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <Badge variant={wc.is_active ? 'default' : 'secondary'}>{wc.is_active ? 'Ativo' : 'Inativo'}</Badge>
                              <p className="text-sm mt-2">{wc.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">Campanha: {wc.divulgador_campaigns?.name || 'Todas'} | Delay: {wc.delay_seconds}s</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PARTICIPANTES */}
          <TabsContent value="participants" className="space-y-6">
            <Card className="border-border/40">
              <CardHeader><CardTitle>Participantes dos Grupos</CardTitle></CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum participante registrado</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Entrada</TableHead>
                          <TableHead>Boas-vindas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {participants.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.whatsapp_number}</TableCell>
                            <TableCell>{p.name || '-'}</TableCell>
                            <TableCell>{p.divulgador_groups?.name || '-'}</TableCell>
                            <TableCell>{p.joined_at ? format(new Date(p.joined_at), 'dd/MM/yy', { locale: ptBR }) : '-'}</TableCell>
                            <TableCell><Badge variant={p.welcome_sent ? 'default' : 'secondary'}>{p.welcome_sent ? 'Enviada' : 'Pendente'}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RELATÓRIOS */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-border/40">
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold">{successLogs}</p>
                  <p className="text-sm text-muted-foreground">Envios com sucesso</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="pt-6 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-3xl font-bold">{errorLogs}</p>
                  <p className="text-sm text-muted-foreground">Envios com erro</p>
                </CardContent>
              </Card>
              <Card className="border-border/40">
                <CardContent className="pt-6 text-center">
                  <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold">{sendLogs.length > 0 ? Math.round((successLogs / sendLogs.length) * 100) : 0}%</p>
                  <p className="text-sm text-muted-foreground">Taxa de sucesso</p>
                </CardContent>
              </Card>
            </div>
            <Card className="border-border/40">
              <CardHeader><CardTitle>Histórico de Envios</CardTitle></CardHeader>
              <CardContent>
                {sendLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum envio registrado</p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Mensagem</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sendLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell>{log.sent_at ? format(new Date(log.sent_at), 'dd/MM HH:mm', { locale: ptBR }) : '-'}</TableCell>
                            <TableCell>{log.divulgador_groups?.name || '-'}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{log.divulgador_messages?.content || '-'}</TableCell>
                            <TableCell><Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>{log.status}</Badge></TableCell>
                            <TableCell className="max-w-[150px] truncate text-destructive">{log.error_message || '-'}</TableCell>
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

        {/* Dialog: Campanha */}
        <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="Nome da campanha" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={campaignForm.description} onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })} placeholder="Descrição opcional" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mín. grupos vazios</Label>
                  <Input type="number" value={campaignForm.min_empty_groups} onChange={(e) => setCampaignForm({ ...campaignForm, min_empty_groups: parseInt(e.target.value) || 3 })} />
                </div>
                <div className="space-y-2">
                  <Label>Máx. participantes</Label>
                  <Input type="number" value={campaignForm.max_participants_per_group} onChange={(e) => setCampaignForm({ ...campaignForm, max_participants_per_group: parseInt(e.target.value) || 250 })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={campaignForm.auto_create_groups} onCheckedChange={(c) => setCampaignForm({ ...campaignForm, auto_create_groups: c })} />
                <Label>Criar grupos automaticamente</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCampaignDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveCampaignMutation.mutate(campaignForm)} disabled={saveCampaignMutation.isPending || !campaignForm.name}>
                {saveCampaignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Mensagem */}
        <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Mensagem</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Campanha</Label>
                <Select value={messageForm.campaign_id} onValueChange={(v) => setMessageForm({ ...messageForm, campaign_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Todos os grupos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {campaigns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de mídia</Label>
                <Select value={messageForm.media_type} onValueChange={(v) => setMessageForm({ ...messageForm, media_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea rows={4} value={messageForm.content} onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })} placeholder="Digite a mensagem..." />
              </div>
              {messageForm.media_type !== 'text' && (
                <div className="space-y-2">
                  <Label>URL da mídia</Label>
                  <Input value={messageForm.media_url} onChange={(e) => setMessageForm({ ...messageForm, media_url: e.target.value })} placeholder="https://..." />
                </div>
              )}
              <div className="space-y-2">
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={messageForm.scheduled_at} onChange={(e) => setMessageForm({ ...messageForm, scheduled_at: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={messageForm.mention_all} onCheckedChange={(c) => setMessageForm({ ...messageForm, mention_all: c })} />
                <Label>Mencionar todos os participantes</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMessageDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMessageMutation.mutate(messageForm)} disabled={saveMessageMutation.isPending || !messageForm.content}>
                {saveMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Agendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
