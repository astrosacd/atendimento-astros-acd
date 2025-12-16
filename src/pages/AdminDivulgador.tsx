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
  Trash2, Edit, Copy, Loader2, CheckCircle2, AlertCircle, Clock, Info,
  FileText, XCircle
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
import { CronConfigCard } from '@/components/divulgador/CronConfigCard';
import { InactiveParticipantsManager } from '@/components/divulgador/InactiveParticipantsManager';
import { AllParticipantsManager } from '@/components/divulgador/AllParticipantsManager';

export default function AdminDivulgador() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('instances');
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isInstanceDialogOpen, setIsInstanceDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isSendingMessages, setIsSendingMessages] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testingInstanceId, setTestingInstanceId] = useState<string | null>(null);
  const [instanceToDelete, setInstanceToDelete] = useState<any>(null);
  const [editingInstance, setEditingInstance] = useState<any>(null);

  // ================== QUERIES ==================

  // Fetch instances
  const { data: instances = [], isLoading: isLoadingInstances } = useQuery({
    queryKey: ['divulgador-instances'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_instances')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['divulgador-campaigns'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_campaigns')
        .select('*, divulgador_instances(instance_name)')
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
        .select('*, divulgador_groups(name)')
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

  // Fetch operation logs
  const { data: operationLogs = [] } = useQuery({
    queryKey: ['divulgador-operation-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_operation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // ================== INSTANCE MANAGEMENT ==================

  const [instanceForm, setInstanceForm] = useState({
    instance_name: '',
    api_url: '',
    api_key: '',
  });

  const saveInstanceMutation = useMutation({
    mutationFn: async (formData: typeof instanceForm) => {
      if (editingInstance) {
        const { data, error } = await (supabase as any)
          .from('divulgador_instances')
          .update(formData)
          .eq('id', editingInstance.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from('divulgador_instances')
          .insert([formData])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: async (savedInstance) => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
      toast.success(editingInstance ? 'Instância atualizada!' : 'Instância salva! Verificando conexão...');
      setIsInstanceDialogOpen(false);
      setInstanceForm({ instance_name: '', api_url: '', api_key: '' });
      setEditingInstance(null);
      
      // Auto-configure webhook
      await configureWebhook(savedInstance);
      
      // Auto-test connection after creating/updating instance
      setTimeout(() => testConnection(savedInstance), 500);
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const toggleInstanceMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('divulgador_instances')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      // Get instance name before deleting to also delete from legacy table
      const { data: instance } = await (supabase as any)
        .from('divulgador_instances')
        .select('instance_name')
        .eq('id', id)
        .single();
      
      // Delete from main table
      const { error } = await (supabase as any)
        .from('divulgador_instances')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      // Also delete from legacy table to prevent re-sync
      if (instance?.instance_name) {
        await (supabase as any)
          .from('divulgador_whatsapp_instance')
          .delete()
          .eq('instance_name', instance.instance_name);
      }
      
      // Clear all groups, participants, welcome configs when no instance remains
      const { data: remainingInstances } = await (supabase as any)
        .from('divulgador_instances')
        .select('id')
        .limit(1);
      
      if (!remainingInstances || remainingInstances.length === 0) {
        // Clear participants first (foreign key)
        await (supabase as any).from('divulgador_participants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // Clear welcome configs
        await (supabase as any).from('divulgador_welcome_config').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // Clear groups
        await (supabase as any).from('divulgador_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-participants'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      setInstanceToDelete(null);
      toast.success('Instância removida e dados limpos!');
    },
  });

  const configureWebhook = async (instance: any) => {
    const webhookUrl = `https://udxaxemoozddkwpitngq.supabase.co/functions/v1/divulgador-welcome`;
    try {
      const response = await fetch(`${instance.api_url}/webhook/set/${instance.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instance.api_key,
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: true,
          webhook_base64: false,
          events: ['GROUP_PARTICIPANTS_UPDATE', 'GROUPS_UPSERT'],
        }),
      });

      if (response.ok) {
        toast.success('Webhook configurado automaticamente!');
      } else {
        // Don't show confusing error - webhook will be configured when instance connects
        console.log('Webhook config returned non-ok, will retry on connection');
      }
    } catch (error) {
      // Don't show confusing error - webhook will be configured when instance connects
      console.log('Webhook config failed, will retry on connection', error);
    }
  };

  // Helper: Log operations to divulgador_operation_logs
  const logDivulgadorOperation = async (operation: string, status: string, message?: string, metadata?: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from('divulgador_operation_logs').insert([{
        user_id: user?.id || null,
        operation,
        status,
        message,
        metadata,
      }]);
    } catch (e) {
      console.error('Failed to log operation:', e);
    }
  };

  const testConnection = async (instance: any) => {
    setTestingInstanceId(instance.id);
    const url = `${instance.api_url}/instance/connectionState/${instance.instance_name}`;
    try {
      const response = await fetch(url, {
        headers: { 'apikey': instance.api_key },
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Evolution API returned non-JSON:', text.substring(0, 200));
        toast.error('A API não retornou JSON. Verifique se a URL e o nome da instância estão corretos.');
        await logDivulgadorOperation('test_connection', 'error', 'API retornou HTML/texto em vez de JSON', { instance_id: instance.id, url });
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const state = data?.instance?.state || data?.state;
        if (state === 'open') {
          toast.success(`${instance.instance_name}: Conectado!`);
          await (supabase as any)
            .from('divulgador_instances')
            .update({ is_connected: true, last_connected_at: new Date().toISOString() })
            .eq('id', instance.id);
          queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
          await logDivulgadorOperation('test_connection', 'success', `Instância ${instance.instance_name} conectada`, { instance_id: instance.id, state });
        } else {
          toast.warning(`${instance.instance_name}: ${state || 'desconhecido'}`);
          await logDivulgadorOperation('test_connection', 'warning', `Estado: ${state}`, { instance_id: instance.id, state });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Falha na conexão: ${errorData?.message || response.statusText}`);
        await logDivulgadorOperation('test_connection', 'error', `HTTP ${response.status}`, { instance_id: instance.id, errorData });
      }
    } catch (error: any) {
      toast.error('Erro de rede: ' + error.message);
      await logDivulgadorOperation('test_connection', 'error', error.message, { instance_id: instance.id, url });
    } finally {
      setTestingInstanceId(null);
    }
  };

  // ================== CAMPAIGN MANAGEMENT ==================

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    instance_id: '',
    min_empty_groups: 3,
    max_participants_per_group: 250,
    auto_create_groups: true,
  });

  const saveCampaignMutation = useMutation({
    mutationFn: async (formData: typeof campaignForm) => {
      const payload = {
        ...formData,
        instance_id: formData.instance_id || null,
      };
      if (editingCampaign) {
        const { error } = await (supabase as any)
          .from('divulgador_campaigns')
          .update(payload)
          .eq('id', editingCampaign.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('divulgador_campaigns')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-campaigns'] });
      toast.success(editingCampaign ? 'Campanha atualizada!' : 'Campanha criada!');
      setIsCampaignDialogOpen(false);
      setEditingCampaign(null);
      setCampaignForm({ name: '', description: '', instance_id: '', min_empty_groups: 3, max_participants_per_group: 250, auto_create_groups: true });
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

  // ================== GROUP MANAGEMENT ==================

  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    campaign_id: '',
  });

  const createGroupViaAPI = async () => {
    if (!groupForm.name) {
      toast.error('Digite o nome do grupo');
      return;
    }
    setIsCreatingGroup(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: {
          action: 'create',
          campaignId: groupForm.campaign_id || null,
          groupName: groupForm.name,
          groupDescription: groupForm.description,
        },
      });
      if (error) throw error;
      toast.success('Grupo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      setIsGroupDialogOpen(false);
      setGroupForm({ name: '', description: '', campaign_id: '' });
    } catch (error: any) {
      toast.error('Erro ao criar grupo: ' + error.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const syncGroupsFromWhatsApp = async () => {
    // Check if there are instances first
    if (instances.length === 0) {
      toast.info('Configure uma instância WhatsApp primeiro na aba "WhatsApp"');
      return;
    }
    
    // Check if any instance is connected
    const hasConnected = instances.some((i: any) => i.is_connected);
    if (!hasConnected) {
      toast.info('Conecte uma instância primeiro. Clique no ícone de atualizar para testar a conexão.');
      return;
    }
    
    setIsSyncing(true);
    try {
      await logDivulgadorOperation('sync_groups', 'info', 'Iniciando sincronização de grupos');
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: { action: 'fetch-groups' },
      });
      if (error) {
        const errorMsg = error.message || '';
        // Handle all instance-related messages as info, not error
        if (errorMsg.includes('instância') || errorMsg.includes('instance') || errorMsg.includes('Nenhuma') || errorMsg.includes('conectada') || errorMsg.includes('desativada')) {
          toast.info(errorMsg.replace('Error, ', '').replace(/[{}"]/g, ''));
          await logDivulgadorOperation('sync_groups', 'warning', errorMsg);
          return;
        }
        throw error;
      }
      const msg = data?.deleted > 0 
        ? `${data?.saved || 0} grupos sincronizados, ${data?.deleted} removidos!`
        : `${data?.groups?.length || 0} grupos sincronizados!`;
      toast.success(msg);
      await logDivulgadorOperation('sync_groups', 'success', msg, { saved: data?.saved, deleted: data?.deleted });
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-operation-logs'] });
    } catch (error: any) {
      const errorMsg = error.message || '';
      // Handle all instance-related messages as info, not error
      if (errorMsg.includes('instância') || errorMsg.includes('instance') || errorMsg.includes('conectada') || errorMsg.includes('desativada')) {
        toast.info(errorMsg.replace('Error, ', '').replace(/[{}"]/g, ''));
        await logDivulgadorOperation('sync_groups', 'warning', errorMsg);
      } else {
        toast.error('Erro ao sincronizar: ' + errorMsg);
        await logDivulgadorOperation('sync_groups', 'error', errorMsg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const runMonitoring = async () => {
    setIsMonitoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-monitor');
      if (error) throw error;
      const created = data?.results?.filter((r: any) => r.status === 'created').length || 0;
      toast.success(`Monitoramento concluído. ${created} grupos criados automaticamente.`);
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
    } catch (error: any) {
      toast.error('Erro no monitoramento: ' + error.message);
    } finally {
      setIsMonitoring(false);
    }
  };

  // ================== MESSAGE MANAGEMENT ==================

  const [messageForm, setMessageForm] = useState({
    campaign_id: '',
    content: '',
    media_type: 'text',
    media_url: '',
    scheduled_at: '',
    mention_all: false,
    delay_seconds: 2,
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
      setMessageForm({ campaign_id: '', content: '', media_type: 'text', media_url: '', scheduled_at: '', mention_all: false, delay_seconds: 2 });
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

  const sendPendingMessages = async () => {
    setIsSendingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-send-messages');
      if (error) throw error;
      toast.success(`Mensagens processadas: ${data?.processed?.length || 0}`);
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-logs'] });
    } catch (error: any) {
      toast.error('Erro ao enviar: ' + error.message);
    } finally {
      setIsSendingMessages(false);
    }
  };

  // ================== WELCOME MESSAGE MANAGEMENT ==================

  const [welcomeForm, setWelcomeForm] = useState({
    group_id: '',
    message: '',
    is_active: true,
    delay_seconds: 5,
  });

  const saveWelcomeMutation = useMutation({
    mutationFn: async (formData: typeof welcomeForm) => {
      const { error } = await (supabase as any)
        .from('divulgador_welcome_config')
        .insert([{ ...formData, group_id: formData.group_id || null }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      toast.success('Boas-vindas salva!');
      setWelcomeForm({ group_id: '', message: '', is_active: true, delay_seconds: 5 });
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const deleteWelcomeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('divulgador_welcome_config').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      toast.success('Template removido!');
    },
  });

  // ================== STATS ==================

  const totalGroups = groups.length;
  const activeGroups = groups.filter((g: any) => g.is_active).length;
  const totalParticipants = participants.length;
  const pendingMessages = messages.filter((m: any) => m.status === 'pending').length;
  const successLogs = sendLogs.filter((l: any) => l.status === 'sent').length;
  const errorLogs = sendLogs.filter((l: any) => l.status === 'failed').length;
  const activeInstances = instances.filter((i: any) => i.is_active && i.is_connected).length;

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
          <Badge variant={activeInstances > 0 ? "default" : "secondary"} className="gap-1.5">
            {activeInstances > 0 ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {activeInstances} {activeInstances === 1 ? 'instância' : 'instâncias'} ativas
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10"><Wifi className="h-4 w-4 text-orange-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{instances.length}</p>
                  <p className="text-xs text-muted-foreground">Instâncias</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <p className="text-xs text-muted-foreground">{pendingMessages} pendentes</p>
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
            <TabsTrigger value="instances" className="gap-2 py-2"><Wifi className="h-4 w-4" /><span className="hidden sm:inline">WhatsApp</span></TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2 py-2"><Target className="h-4 w-4" /><span className="hidden sm:inline">Campanhas</span></TabsTrigger>
            <TabsTrigger value="groups" className="gap-2 py-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Grupos</span></TabsTrigger>
            <TabsTrigger value="messages" className="gap-2 py-2"><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Mensagens</span></TabsTrigger>
            <TabsTrigger value="welcome" className="gap-2 py-2"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Boas-vindas</span></TabsTrigger>
            <TabsTrigger value="participants" className="gap-2 py-2"><UserMinus className="h-4 w-4" /><span className="hidden sm:inline">Participantes</span></TabsTrigger>
            <TabsTrigger value="logs" className="gap-2 py-2"><FileText className="h-4 w-4" /><span className="hidden sm:inline">Logs</span></TabsTrigger>
          </TabsList>

          {/* TAB: INSTÂNCIAS WHATSAPP */}
          <TabsContent value="instances" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Instâncias WhatsApp</h2>
                <p className="text-sm text-muted-foreground">Configure seus números Evolution API para envio de mensagens</p>
              </div>
              <Button onClick={() => { setEditingInstance(null); setInstanceForm({ instance_name: '', api_url: '', api_key: '' }); setIsInstanceDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Nova Instância
              </Button>
            </div>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600 dark:text-amber-400">Como funciona?</p>
                    <p className="text-muted-foreground mt-1">
                      Ao adicionar uma instância, o webhook é configurado automaticamente para detectar novos participantes 
                      e enviar mensagens de boas-vindas. Você pode ter múltiplas instâncias para diferentes campanhas.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="pt-6">
                {isLoadingInstances ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : instances.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma instância configurada. Clique em "Nova Instância" para começar.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>API URL</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instances.map((inst: any) => (
                        <TableRow key={inst.id}>
                          <TableCell className="font-medium">{inst.instance_name}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">{inst.api_url}</TableCell>
                          <TableCell>
                            <Badge variant={inst.is_connected ? "default" : "secondary"} className="gap-1">
                              {inst.is_connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                              {inst.is_connected ? 'Conectado' : 'Desconectado'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={inst.is_active}
                              onCheckedChange={(checked) => toggleInstanceMutation.mutate({ id: inst.id, is_active: checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => testConnection(inst)} disabled={testingInstanceId === inst.id}>
                                {testingInstanceId === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditingInstance(inst);
                                setInstanceForm({ instance_name: inst.instance_name, api_url: inst.api_url, api_key: inst.api_key });
                                setIsInstanceDialogOpen(true);
                              }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setInstanceToDelete(inst)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* CRON Configuration */}
            <CronConfigCard />
          </TabsContent>

          {/* TAB: CAMPANHAS */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Campanhas</h2>
                <p className="text-sm text-muted-foreground">Organize seus grupos em campanhas para envio segmentado</p>
              </div>
              <Button onClick={() => { setEditingCampaign(null); setCampaignForm({ name: '', description: '', instance_id: '', min_empty_groups: 3, max_participants_per_group: 250, auto_create_groups: true }); setIsCampaignDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Nova Campanha
              </Button>
            </div>

            <div className="grid gap-4">
              {campaigns.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Nenhuma campanha criada. Campanhas ajudam a organizar grupos e mensagens.</CardContent></Card>
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
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {campaign.divulgador_instances?.instance_name && (
                                <Badge variant="outline" className="gap-1">
                                  <Wifi className="h-3 w-3" />
                                  {campaign.divulgador_instances.instance_name}
                                </Badge>
                              )}
                              <Badge variant="outline">Min grupos vazios: {campaign.min_empty_groups}</Badge>
                              <Badge variant="outline">Max participantes: {campaign.max_participants_per_group}</Badge>
                              <Badge variant={campaign.is_active ? "default" : "secondary"}>{campaign.is_active ? 'Ativa' : 'Inativa'}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { 
                            setEditingCampaign(campaign); 
                            setCampaignForm({ 
                              name: campaign.name, 
                              description: campaign.description || '', 
                              instance_id: campaign.instance_id || '',
                              min_empty_groups: campaign.min_empty_groups, 
                              max_participants_per_group: campaign.max_participants_per_group, 
                              auto_create_groups: campaign.auto_create_groups 
                            }); 
                            setIsCampaignDialogOpen(true); 
                          }}>
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

          {/* TAB: GRUPOS */}
          <TabsContent value="groups" className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold">Grupos</h2>
                <p className="text-sm text-muted-foreground">Gerencie os grupos vinculados às campanhas</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={syncGroupsFromWhatsApp} disabled={isSyncing || instances.length === 0 || !instances.some((i: any) => i.is_connected)}>
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar do WhatsApp
                </Button>
                <Button variant="outline" onClick={runMonitoring} disabled={isMonitoring || instances.length === 0 || !instances.some((i: any) => i.is_connected)}>
                  {isMonitoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                  Auto-criar Grupos
                </Button>
                <Button onClick={() => setIsGroupDialogOpen(true)} disabled={instances.length === 0 || !instances.some((i: any) => i.is_connected)}>
                  <Plus className="h-4 w-4 mr-2" />Criar Grupo
                </Button>
              </div>
            </div>

            {instances.length === 0 ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                  <p className="font-medium text-amber-600 dark:text-amber-400">Nenhuma instância configurada</p>
                  <p className="text-sm text-muted-foreground mt-1">Configure uma instância WhatsApp na aba "WhatsApp" para sincronizar grupos.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('instances')}>
                    <Settings className="h-4 w-4 mr-2" />Configurar Instância
                  </Button>
                </CardContent>
              </Card>
            ) : !instances.some((i: any) => i.is_connected) ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-8 text-center">
                  <WifiOff className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                  <p className="font-medium text-amber-600 dark:text-amber-400">Instância não conectada</p>
                  <p className="text-sm text-muted-foreground mt-1">Clique no ícone de atualizar na aba "WhatsApp" para testar a conexão.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab('instances')}>
                    <RefreshCw className="h-4 w-4 mr-2" />Ir para Instâncias
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/40">
                <CardContent className="pt-6">
                  {groups.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhum grupo encontrado. Clique em "Sincronizar do WhatsApp" para importar grupos existentes.</p>
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
            )}
          </TabsContent>

          {/* TAB: MENSAGENS */}
          <TabsContent value="messages" className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold">Mensagens Agendadas</h2>
                <p className="text-sm text-muted-foreground">Agende mensagens para envio aos grupos das campanhas</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={sendPendingMessages} disabled={isSendingMessages || pendingMessages === 0}>
                  {isSendingMessages ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar Agora ({pendingMessages})
                </Button>
                <Button onClick={() => setIsMessageDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Mensagem</Button>
              </div>
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

            {/* Reports Section */}
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
          </TabsContent>

          {/* TAB: BOAS-VINDAS */}
          <TabsContent value="welcome" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Mensagens de Boas-vindas</h2>
                <p className="text-sm text-muted-foreground">Configure mensagens automáticas enviadas no privado quando participantes entram nos grupos</p>
              </div>
              <Button variant="outline" onClick={syncGroupsFromWhatsApp} disabled={isSyncing || instances.length === 0 || !instances.some((i: any) => i.is_connected)}>
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sincronizar Grupos
              </Button>
            </div>

            {instances.length === 0 ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600 dark:text-amber-400">Nenhuma instância configurada</p>
                      <p className="text-muted-foreground mt-1">Configure uma instância WhatsApp na aba "WhatsApp" para sincronizar grupos e configurar boas-vindas.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : !instances.some((i: any) => i.is_connected) ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <WifiOff className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600 dark:text-amber-400">Instância não conectada</p>
                      <p className="text-muted-foreground mt-1">Clique no ícone de atualizar na aba "WhatsApp" para testar a conexão.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-base">Nova Mensagem de Boas-vindas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <Select value={welcomeForm.group_id || "_all"} onValueChange={(v) => setWelcomeForm({ ...welcomeForm, group_id: v === "_all" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos os grupos</SelectItem>
                        {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">A mensagem será enviada quando alguém entrar neste grupo</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea rows={4} value={welcomeForm.message} onChange={(e) => setWelcomeForm({ ...welcomeForm, message: e.target.value })} placeholder="Olá {nome}! Bem-vindo ao grupo..." />
                    <p className="text-xs text-muted-foreground">Use {'{nome}'}, {'{numero}'} ou {'{grupo}'} para personalizar</p>
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
                <CardHeader>
                  <CardTitle className="text-base">Templates Configurados</CardTitle>
                </CardHeader>
                <CardContent>
                  {welcomeConfigs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhum template criado</p>
                  ) : (
                    <div className="space-y-3">
                      {welcomeConfigs.map((wc: any) => (
                        <div key={wc.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={wc.is_active ? 'default' : 'secondary'}>{wc.is_active ? 'Ativo' : 'Inativo'}</Badge>
                                <Badge variant="outline">{wc.divulgador_groups?.name || 'Todos os grupos'}</Badge>
                              </div>
                              <p className="text-sm">{wc.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">Delay: {wc.delay_seconds}s</p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteWelcomeMutation.mutate(wc.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB: PARTICIPANTES */}
          <TabsContent value="participants" className="space-y-6">
            {instances.length === 0 ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600 dark:text-amber-400">Nenhuma instância configurada</p>
                      <p className="text-muted-foreground mt-1">Configure uma instância WhatsApp na aba "WhatsApp" para sincronizar participantes.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : !instances.some((i: any) => i.is_connected) ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <WifiOff className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600 dark:text-amber-400">Instância não conectada</p>
                      <p className="text-muted-foreground mt-1">Clique no ícone de atualizar na aba "WhatsApp" para testar a conexão.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            
            <AllParticipantsManager />
            
            <InactiveParticipantsManager />
          </TabsContent>

          {/* TAB: LOGS */}
          <TabsContent value="logs" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Logs de Envio</h2>
              <p className="text-sm text-muted-foreground">Histórico de mensagens enviadas, erros e detalhes</p>
            </div>

            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Histórico de Envios</CardTitle>
                      <CardDescription>
                        {successLogs} enviados com sucesso, {errorLogs} com erro
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {sendLogs.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {sendLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum log de envio encontrado. Agende e envie mensagens para ver os logs aqui.
                  </p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Mensagem</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sendLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.sent_at ? format(new Date(log.sent_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {log.divulgador_groups?.name || 'Grupo desconhecido'}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate text-sm">
                              {log.divulgador_messages?.content || '-'}
                            </TableCell>
                            <TableCell>
                              {log.status === 'sent' ? (
                                <Badge variant="default" className="bg-emerald-500 gap-1.5">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Enviado
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="gap-1.5">
                                  <XCircle className="h-3 w-3" />
                                  Erro
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[250px] text-sm text-muted-foreground">
                              {log.error_message || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Card: Histórico de Operações */}
            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Clock className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <CardTitle>Histórico de Operações</CardTitle>
                      <CardDescription>
                        Sincronizações, conexões, erros e demais ações do módulo
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {operationLogs.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {operationLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum log de operação encontrado. Sincronizações e testes de conexão aparecerão aqui.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Operação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Mensagem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {operationLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.created_at ? format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.operation}</Badge>
                            </TableCell>
                            <TableCell>
                              {log.status === 'success' ? (
                                <Badge variant="default" className="bg-emerald-500 gap-1.5">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Sucesso
                                </Badge>
                              ) : log.status === 'error' ? (
                                <Badge variant="destructive" className="gap-1.5">
                                  <XCircle className="h-3 w-3" />
                                  Erro
                                </Badge>
                              ) : log.status === 'warning' ? (
                                <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 gap-1.5">
                                  <AlertCircle className="h-3 w-3" />
                                  Aviso
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1.5">
                                  <Info className="h-3 w-3" />
                                  Info
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[400px] text-sm text-muted-foreground">
                              {log.message || '-'}
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

        {/* Dialog: Nova/Editar Instância */}
        <Dialog open={isInstanceDialogOpen} onOpenChange={(open) => { setIsInstanceDialogOpen(open); if (!open) { setEditingInstance(null); setInstanceForm({ instance_name: '', api_url: '', api_key: '' }); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingInstance ? 'Editar Instância WhatsApp' : 'Nova Instância WhatsApp'}</DialogTitle>
              <DialogDescription>{editingInstance ? 'Atualize os dados da instância Evolution API.' : 'Configure uma instância Evolution API. O webhook será configurado automaticamente.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>URL da API Evolution</Label>
                <Input value={instanceForm.api_url} onChange={(e) => setInstanceForm({ ...instanceForm, api_url: e.target.value })} placeholder="https://api.seudominio.com" />
                <p className="text-xs text-muted-foreground">Endereço completo da sua Evolution API (ex: https://apievo.exemplo.com)</p>
              </div>
              <div className="space-y-2">
                <Label>Nome da Instância (no painel Evolution)</Label>
                <Input value={instanceForm.instance_name} onChange={(e) => setInstanceForm({ ...instanceForm, instance_name: e.target.value })} placeholder="Nome_Da_Instancia" />
                <p className="text-xs text-muted-foreground">Nome exato da instância configurada na Evolution API</p>
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" value={instanceForm.api_key} onChange={(e) => setInstanceForm({ ...instanceForm, api_key: e.target.value })} placeholder="Sua API Key" />
                <p className="text-xs text-muted-foreground">Chave de autenticação da Evolution API</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsInstanceDialogOpen(false); setEditingInstance(null); setInstanceForm({ instance_name: '', api_url: '', api_key: '' }); }}>Cancelar</Button>
              <Button onClick={() => saveInstanceMutation.mutate(instanceForm)} disabled={saveInstanceMutation.isPending || !instanceForm.instance_name || !instanceForm.api_url || !instanceForm.api_key}>
                {saveInstanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingInstance ? 'Atualizar' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              <div className="space-y-2">
                <Label>Instância WhatsApp</Label>
                <Select value={campaignForm.instance_id || "_none"} onValueChange={(v) => setCampaignForm({ ...campaignForm, instance_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma (usar qualquer)</SelectItem>
                    {instances.map((inst: any) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.instance_name} {inst.is_connected ? '(Conectado)' : '(Desconectado)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Vincule a campanha a um número WhatsApp específico</p>
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
                <Label>Criar grupos automaticamente quando atingir limite</Label>
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
                <Select value={messageForm.campaign_id || "_all"} onValueChange={(v) => setMessageForm({ ...messageForm, campaign_id: v === "_all" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Todos os grupos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os grupos</SelectItem>
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
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={messageForm.mention_all} onCheckedChange={(c) => setMessageForm({ ...messageForm, mention_all: c })} />
                  <Label>Mencionar todos</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Delay entre grupos (seg):</Label>
                  <Input 
                    type="number" 
                    className="w-20" 
                    min={1}
                    max={60}
                    value={messageForm.delay_seconds} 
                    onChange={(e) => setMessageForm({ ...messageForm, delay_seconds: parseInt(e.target.value) || 2 })} 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O delay evita bloqueios ao enviar para múltiplos grupos. Recomendado: 2-5 segundos.
              </p>
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

        {/* Dialog: Criar Grupo */}
        <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Grupo</DialogTitle>
              <DialogDescription>O grupo será criado via Evolution API</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Grupo</Label>
                <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Nome do grupo no WhatsApp" />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea rows={2} value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} placeholder="Descrição do grupo" />
              </div>
              <div className="space-y-2">
                <Label>Vincular à Campanha (opcional)</Label>
                <Select value={groupForm.campaign_id || "_none"} onValueChange={(v) => setGroupForm({ ...groupForm, campaign_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma campanha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma</SelectItem>
                    {campaigns.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>Cancelar</Button>
              <Button onClick={createGroupViaAPI} disabled={isCreatingGroup || !groupForm.name}>
                {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar Grupo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Confirmar exclusão de instância */}
        <Dialog open={!!instanceToDelete} onOpenChange={(open) => !open && setInstanceToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir a instância "{instanceToDelete?.instance_name}"?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-destructive">Atenção: Esta ação irá:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Remover permanentemente a instância</li>
                        <li>Limpar todos os grupos sincronizados (se for a última instância)</li>
                        <li>Remover participantes e configurações de boas-vindas associadas</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInstanceToDelete(null)}>Cancelar</Button>
              <Button 
                variant="destructive" 
                onClick={() => instanceToDelete && deleteInstanceMutation.mutate(instanceToDelete.id)}
                disabled={deleteInstanceMutation.isPending}
              >
                {deleteInstanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Excluir Instância
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
