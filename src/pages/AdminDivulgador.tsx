import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Megaphone, Settings, Target, Users, MessageSquare, Sparkles,
  UserMinus, BarChart3, Plus, Save, RefreshCw, Wifi, WifiOff, Send,
  Trash2, Edit, Copy, Loader2, CheckCircle2, AlertCircle, Clock, Info,
  FileText, XCircle, Upload, Image, Lock, Shield, CalendarIcon, Pencil,
  Eye, Music, Video, BarChart2, Check, CheckCheck
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
import { format, addHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helper para converter data local para ISO - o navegador já lida com timezone
const toUtcFromLocal = (localDateString: string): string => {
  // O input datetime-local fornece a hora local do usuário
  // new Date() interpreta como local e toISOString() converte para UTC automaticamente
  return new Date(localDateString).toISOString();
};

// Helper para exibir data UTC como horário local do navegador
const formatFromUtc = (utcDateString: string, formatStr: string): string => {
  // new Date() converte de UTC para o timezone local do navegador automaticamente
  return format(new Date(utcDateString), formatStr, { locale: ptBR });
};
import { CronConfigCard } from '@/components/divulgador/CronConfigCard';
import { InactiveParticipantsManager } from '@/components/divulgador/InactiveParticipantsManager';
import { AllParticipantsManager } from '@/components/divulgador/AllParticipantsManager';
import { PollResultsHistory } from '@/components/divulgador/PollResultsHistory';
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';

export default function AdminDivulgador() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'instances');
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
  const [messagesFilterGroup, setMessagesFilterGroup] = useState<string>('_all');
  const [messagesStatusFilter, setMessagesStatusFilter] = useState<string>(() => searchParams.get('filter') || '_all');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [defaultParticipant, setDefaultParticipant] = useState('');
  const [isQuickMessageDialogOpen, setIsQuickMessageDialogOpen] = useState(false);
  const [quickMessageGroup, setQuickMessageGroup] = useState<any>(null);
  const [quickMessageForm, setQuickMessageForm] = useState({ 
    content: '', 
    mention_all: false, 
    media_type: 'text',
    media_url: '' 
  });
  const [isSendingQuickMessage, setIsSendingQuickMessage] = useState(false);
  const [isUploadingQuickMedia, setIsUploadingQuickMedia] = useState(false);
  const [apiDebugResponse, setApiDebugResponse] = useState<any>(null);
  const [isApiDebugDialogOpen, setIsApiDebugDialogOpen] = useState(false);
  const [isCommunity, setIsCommunity] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState<any>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editMessageForm, setEditMessageForm] = useState({
    content: '',
    scheduled_at: '',
    media_type: 'text',
    media_url: '',
    mention_all: false,
    delay_seconds: 2,
    poll_options: ['', '', ''] as string[],
    poll_selectable_count: 1,
    campaign_id: '', // group_id
  });
  const [isUploadingEditMedia, setIsUploadingEditMedia] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<any>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<any>(null);
  const [duplicateDateTime, setDuplicateDateTime] = useState('');
  const [checkingWebhookId, setCheckingWebhookId] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [isReconfiguringWebhook, setIsReconfiguringWebhook] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  // ================== QUERIES ==================

  // Fetch instances
  const { data: instances = [], isLoading: isLoadingInstances, isFetching: isFetchingInstances } = useQuery({
    queryKey: ['divulgador-instances'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_instances')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10000, // 10 segundos
    gcTime: 60000, // Mantém cache por 1 minuto
    refetchOnWindowFocus: false, // Evita refetch ao trocar de janela
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
        .select('*, divulgador_campaigns(name), divulgador_instances(instance_name)')
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
        .select('*, divulgador_campaigns(name), divulgador_groups(name)')
        .order('scheduled_at', { ascending: false });
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

  // Fetch default participant config
  const { data: divulgadorConfig = [] } = useQuery({
    queryKey: ['divulgador-config'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_config')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Set default participant when config loads
  useEffect(() => {
    const defaultParticipantConfig = divulgadorConfig.find((c: any) => c.config_key === 'default_participant');
    if (defaultParticipantConfig) {
      setDefaultParticipant(defaultParticipantConfig.config_value);
    }
  }, [divulgadorConfig]);

  // Save default participant config
  const saveDefaultParticipantMutation = useMutation({
    mutationFn: async (value: string) => {
      const existing = divulgadorConfig.find((c: any) => c.config_key === 'default_participant');
      if (existing) {
        const { error } = await (supabase as any)
          .from('divulgador_config')
          .update({ config_value: value })
          .eq('config_key', 'default_participant');
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('divulgador_config')
          .insert([{ config_key: 'default_participant', config_value: value }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-config'] });
      toast.success('Participante padrão salvo!');
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  // Upload media file to storage
  const uploadMediaFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `messages/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('divulgador-media')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Use signed URL for private bucket (expires in 1 year = 31536000 seconds)
    const { data } = await supabase.storage
      .from('divulgador-media')
      .createSignedUrl(filePath, 31536000);

    if (!data?.signedUrl) throw new Error('Não foi possível gerar URL do arquivo');

    return data.signedUrl;
  };

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    try {
      const url = await uploadMediaFile(file);
      setMessageForm({ ...messageForm, media_url: url });
      toast.success('Arquivo enviado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao enviar arquivo: ' + error.message);
    } finally {
      setIsUploadingMedia(false);
    }
  };

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
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: {
          action: 'configure-webhook',
          instanceId: instance.id,
        },
      });

      if (error) {
        // Não mostrar erro de rede/CORS aqui — a configuração será reavaliada no teste de conexão
        console.log('Webhook config error:', error);
        return;
      }

      if (data?.success) {
        toast.success('Webhook configurado automaticamente!');
      }
    } catch (error) {
      console.log('Webhook config failed:', error);
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
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: {
          action: 'test-connection',
          instanceId: instance.id,
        },
      });

      if (error) {
        toast.error('Falha ao testar conexão: ' + error.message);
        await logDivulgadorOperation('test_connection', 'error', error.message, { instance_id: instance.id });
        return;
      }

      const state = data?.state;

      if (state === 'open') {
        toast.success(`${instance.instance_name}: Conectado!`);
        await (supabase as any)
          .from('divulgador_instances')
          .update({ is_connected: true, last_connected_at: new Date().toISOString() })
          .eq('id', instance.id);
        queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
        await logDivulgadorOperation('test_connection', 'success', `Instância ${instance.instance_name} conectada`, { instance_id: instance.id, state });

        // Se conectou, tenta (re)configurar webhook
        await configureWebhook(instance);
      } else {
        toast.warning(`${instance.instance_name}: ${state || 'desconhecido'}`);
        await (supabase as any)
          .from('divulgador_instances')
          .update({ is_connected: false })
          .eq('id', instance.id);
        queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
        await logDivulgadorOperation('test_connection', 'warning', `Estado: ${state}`, { instance_id: instance.id, state });
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
      await logDivulgadorOperation('test_connection', 'error', error.message, { instance_id: instance.id });
    } finally {
      setTestingInstanceId(null);
    }
  };

  // Check webhook status for an instance
  const checkWebhookStatus = async (instance: any) => {
    setCheckingWebhookId(instance.id);
    setWebhookStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: {
          action: 'get-webhook-status',
          instanceId: instance.id,
        },
      });

      if (error) {
        toast.error('Erro ao verificar webhook: ' + error.message);
        return;
      }

      setWebhookStatus({ ...data, instanceName: instance.instance_name, instanceId: instance.id });
      
      if (data?.isConfigured && data?.hasGroupEvent) {
        toast.success(`Webhook configurado corretamente para ${instance.instance_name}!`);
      } else if (data?.currentUrl) {
        toast.warning(`Webhook configurado com URL diferente ou eventos incorretos`);
      } else {
        toast.error(`Webhook NÃO configurado para ${instance.instance_name}`);
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setCheckingWebhookId(null);
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
    initial_participant: '',
    instance_id: '',
    photo_url: '',
    admin_only: false,
  });

  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({
    name: '',
    description: '',
    photo_url: '',
    admin_only: false,
    locked: false, // Only admins can edit group info
  });
  const [isUploadingGroupPhoto, setIsUploadingGroupPhoto] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState<string | null>(null);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);

  const uploadGroupPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `group_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `group-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('divulgador-media')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Use signed URL for private bucket (expires in 1 year = 31536000 seconds)
    const { data } = await supabase.storage
      .from('divulgador-media')
      .createSignedUrl(filePath, 31536000);

    if (!data?.signedUrl) throw new Error('Não foi possível gerar URL da foto');

    return data.signedUrl;
  };

  const handleGroupPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingGroupPhoto(true);
    try {
      const url = await uploadGroupPhoto(file);
      if (isEdit) {
        setEditGroupForm({ ...editGroupForm, photo_url: url });
      } else {
        setGroupForm({ ...groupForm, photo_url: url });
      }
      toast.success('Foto carregada!');
    } catch (error: any) {
      toast.error('Erro ao enviar foto: ' + error.message);
    } finally {
      setIsUploadingGroupPhoto(false);
    }
  };

  const createGroupViaAPI = async () => {
    if (!groupForm.name) {
      toast.error('Digite o nome do grupo');
      return;
    }
    if (!groupForm.instance_id) {
      toast.error('Selecione uma instância WhatsApp');
      return;
    }
    if (!groupForm.initial_participant) {
      toast.error('Digite o número WhatsApp do participante inicial (obrigatório para criar grupo via API)');
      return;
    }
    
    const formattedNumber = groupForm.initial_participant.replace(/\D/g, '');
    if (formattedNumber.length < 10) {
      toast.error('Número inválido. Digite com DDD (ex: 11999999999)');
      return;
    }
    
    setIsCreatingGroup(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: {
          action: 'create',
          instanceId: groupForm.instance_id,
          campaignId: groupForm.campaign_id || null,
          groupName: groupForm.name,
          groupDescription: groupForm.description,
          participants: [`${formattedNumber}@s.whatsapp.net`],
          groupPhoto: groupForm.photo_url || null,
          adminOnly: groupForm.admin_only,
        },
      });
      if (error) throw error;
      toast.success('Grupo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      setIsGroupDialogOpen(false);
      setGroupForm({ name: '', description: '', campaign_id: '', initial_participant: '', instance_id: '', photo_url: '', admin_only: false });
    } catch (error: any) {
      toast.error('Erro ao criar grupo: ' + error.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const updateGroupViaAPI = async () => {
    if (!editingGroup) return;
    
    setIsUpdatingGroup(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: {
          action: 'update-group',
          groupId: editingGroup.id,
          groupName: editGroupForm.name,
          groupDescription: editGroupForm.description,
          groupPhoto: editGroupForm.photo_url || null,
          adminOnly: editGroupForm.admin_only,
          locked: editGroupForm.locked,
        },
      });
      if (error) throw error;
      
      // Show debug modal with API responses
      if (data?.apiResponses) {
        setApiDebugResponse({
          action: 'update-group',
          groupName: editGroupForm.name,
          instance: data.instance,
          groupJid: data.groupJid,
          responses: data.apiResponses,
          success: data.success,
          nameUpdated: data.nameUpdated,
        });
        setIsApiDebugDialogOpen(true);
      }
      
      const hasErrors = data?.apiResponses?.some((r: any) => !r.ok);
      if (hasErrors) {
        toast.warning('Algumas operações falharam. Verifique os detalhes.');
      } else {
        toast.success('Grupo atualizado!');
      }
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      setIsEditGroupDialogOpen(false);
      setEditingGroup(null);
    } catch (error: any) {
      toast.error('Erro ao atualizar grupo: ' + error.message);
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const generateInviteLink = async (group: any) => {
    setIsGeneratingLink(group.id);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: {
          action: 'get-invite-link',
          groupId: group.id,
        },
      });
      if (error) throw error;
      if (data?.inviteLink) {
        __copyToClipboard(data.inviteLink);
        toast.success('Link gerado e copiado!');
        queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      } else {
        toast.error('Não foi possível gerar o link');
      }
    } catch (error: any) {
      toast.error('Erro ao gerar link: ' + error.message);
    } finally {
      setIsGeneratingLink(null);
    }
  };

  const [isLoadingGroupSettings, setIsLoadingGroupSettings] = useState(false);

  const openEditGroupDialog = async (group: any) => {
    setEditingGroup(group);
    setIsCommunity(false); // Reset community status
    // Initialize from DB values first
    setEditGroupForm({
      name: group.name || '',
      description: group.description || '',
      photo_url: '',
      admin_only: group.announce || false,
      locked: group.restrict || false,
    });
    setIsEditGroupDialogOpen(true);
    
    // Then fetch real-time settings from WhatsApp to verify
    setIsLoadingGroupSettings(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: { action: 'get-group-settings', groupId: group.id },
      });
      
      // Check if it's a community - block editing
      if (data?.isCommunity) {
        setIsCommunity(true);
        console.log('[Divulgador] Detected community - editing blocked');
      }
      
      if (data?.success && data?.settings) {
        setEditGroupForm(prev => ({
          ...prev,
          name: data.settings.subject || prev.name,
          description: data.settings.desc || prev.description,
          photo_url: data.settings.pictureUrl || prev.photo_url,
          admin_only: data.settings.announce || false,
          locked: data.settings.restrict || false,
        }));
        // Also update the editing group reference to show current photo
        setEditingGroup((prev: any) => ({
          ...prev,
          photo_url: data.settings.pictureUrl || prev?.photo_url,
        }));
      } else if (!data?.success && data?.isCommunity) {
        // Group not found in regular groups - likely a community
        setIsCommunity(true);
      }
    } catch (error) {
      console.error('Failed to fetch group settings:', error);
    } finally {
      setIsLoadingGroupSettings(false);
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
    campaign_id: '', // Now used as group_id selection
    content: '',
    media_type: 'text',
    media_url: '',
    scheduled_at: '',
    mention_all: false,
    delay_seconds: 2,
    poll_options: ['', '', ''] as string[],
    poll_selectable_count: 1,
  });

  const saveMessageMutation = useMutation({
    mutationFn: async (formData: typeof messageForm) => {
      // campaign_id field is now used to store group_id selection
      const selectedGroupId = formData.campaign_id || null;
      
      // Prepare poll options - filter empty strings
      const pollOptions = formData.media_type === 'poll' 
        ? formData.poll_options.filter(opt => opt.trim() !== '')
        : null;
      
      const { error } = await (supabase as any)
        .from('divulgador_messages')
        .insert([{
          content: formData.content,
          media_type: formData.media_type || 'text',
          media_url: formData.media_url || null,
          scheduled_at: formData.scheduled_at ? toUtcFromLocal(formData.scheduled_at) : null,
          mention_all: formData.mention_all,
          delay_seconds: formData.delay_seconds,
          group_id: selectedGroupId, // Store selected group
          campaign_id: null, // No longer using campaign
          status: 'pending',
          poll_options: pollOptions,
          poll_selectable_count: formData.media_type === 'poll' ? formData.poll_selectable_count : null,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem agendada!');
      setIsMessageDialogOpen(false);
      setMessageForm({ campaign_id: '', content: '', media_type: 'text', media_url: '', scheduled_at: '', mention_all: false, delay_seconds: 2, poll_options: ['', '', ''], poll_selectable_count: 1 });
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

  const rescheduleMessageMutation = useMutation({
    mutationFn: async ({ id, newDateTime }: { id: string; newDateTime: string }) => {
      const { error } = await (supabase as any)
        .from('divulgador_messages')
        .update({ 
          scheduled_at: toUtcFromLocal(newDateTime),
          status: 'pending'
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem reagendada com sucesso!');
      setRescheduleMessage(null);
      setRescheduleDateTime('');
    },
    onError: (error: any) => toast.error('Erro ao reagendar: ' + error.message),
  });

  const editMessageMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: typeof editMessageForm }) => {
      const pollOptions = form.media_type === 'poll'
        ? form.poll_options.filter(opt => opt.trim() !== '')
        : null;
      const { error } = await (supabase as any)
        .from('divulgador_messages')
        .update({
          content: form.content,
          scheduled_at: form.scheduled_at ? toUtcFromLocal(form.scheduled_at) : null,
          media_type: form.media_type || 'text',
          media_url: form.media_type !== 'text' && form.media_type !== 'poll' ? (form.media_url || null) : null,
          mention_all: form.mention_all,
          delay_seconds: form.delay_seconds,
          group_id: form.campaign_id || null,
          poll_options: pollOptions,
          poll_selectable_count: form.media_type === 'poll' ? form.poll_selectable_count : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem atualizada com sucesso!');
      setEditingMessage(null);
      setEditMessageForm({ content: '', scheduled_at: '', media_type: 'text', media_url: '', mention_all: false, delay_seconds: 2, poll_options: ['', '', ''], poll_selectable_count: 1, campaign_id: '' });
    },
    onError: (error: any) => toast.error('Erro ao editar: ' + error.message),
  });

  const handleEditMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingEditMedia(true);
    try {
      const url = await uploadMediaFile(file);
      setEditMessageForm(prev => ({ ...prev, media_url: url }));
      toast.success('Arquivo enviado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao enviar arquivo: ' + error.message);
    } finally {
      setIsUploadingEditMedia(false);
    }
  };

  const duplicateMessageMutation = useMutation({
    mutationFn: async ({ originalMessage, newDateTime }: { originalMessage: any; newDateTime: string }) => {
      const { error } = await (supabase as any)
        .from('divulgador_messages')
        .insert([{
          content: originalMessage.content,
          media_type: originalMessage.media_type,
          media_url: originalMessage.media_url,
          scheduled_at: toUtcFromLocal(newDateTime),
          mention_all: originalMessage.mention_all,
          delay_seconds: originalMessage.delay_seconds,
          group_id: originalMessage.group_id,
          campaign_id: originalMessage.campaign_id,
          status: 'pending',
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      toast.success('Mensagem duplicada com sucesso!');
      setDuplicateMessage(null);
      setDuplicateDateTime('');
    },
    onError: (error: any) => toast.error('Erro ao duplicar: ' + error.message),
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

  // Send quick message to a specific group
  const sendQuickMessage = async () => {
    if (!quickMessageGroup || !quickMessageForm.content) return;
    
    setIsSendingQuickMessage(true);
    try {
      // Insert message as immediate (no schedule, just pending)
      const { data: messageData, error: insertError } = await (supabase as any)
        .from('divulgador_messages')
        .insert([{
          content: quickMessageForm.content,
          media_type: quickMessageForm.media_type || 'text',
          media_url: quickMessageForm.media_url || null,
          group_id: quickMessageGroup.id,
          mention_all: quickMessageForm.mention_all,
          status: 'pending',
          scheduled_at: new Date().toISOString(),
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Trigger send immediately
      const { data: sendData, error: sendError } = await supabase.functions.invoke('divulgador-send-messages');
      if (sendError) throw sendError;
      
      // Show debug modal with send results
      if (sendData?.processed) {
        const processedMsg = sendData.processed.find((p: any) => p.messageId === messageData.id);
        setApiDebugResponse({
          action: 'send-message',
          groupName: quickMessageGroup.name,
          content: quickMessageForm.content,
          mediaType: quickMessageForm.media_type,
          mentionAll: quickMessageForm.mention_all,
          result: processedMsg || { status: 'sent via batch', processed: sendData.processed },
          success: sendData.success,
        });
        setIsApiDebugDialogOpen(true);
      }
      
      toast.success('Mensagem enviada!');
      queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-logs'] });
      setIsQuickMessageDialogOpen(false);
      setQuickMessageForm({ content: '', mention_all: false, media_type: 'text', media_url: '' });
      setQuickMessageGroup(null);
    } catch (error: any) {
      toast.error('Erro ao enviar: ' + error.message);
    } finally {
      setIsSendingQuickMessage(false);
    }
  };

  // Handle quick message media upload
  const handleQuickMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingQuickMedia(true);
    try {
      const url = await uploadMediaFile(file);
      setQuickMessageForm({ ...quickMessageForm, media_url: url });
      toast.success('Arquivo enviado!');
    } catch (error: any) {
      toast.error('Erro ao enviar arquivo: ' + error.message);
    } finally {
      setIsUploadingQuickMedia(false);
    }
  };

  // ================== WELCOME MESSAGE MANAGEMENT ==================

  const [welcomeForm, setWelcomeForm] = useState({
    group_id: '',
    message: '',
    is_active: true,
    delay_seconds: 5,
    message_type: 'join' as 'join' | 'leave',
  });

  // States for editing and duplicating welcome configs
  const [editingWelcome, setEditingWelcome] = useState<any>(null);
  const [duplicatingWelcome, setDuplicatingWelcome] = useState<any>(null);
  const [duplicateWelcomeGroupId, setDuplicateWelcomeGroupId] = useState<string>('');

  const saveWelcomeMutation = useMutation({
    mutationFn: async (formData: typeof welcomeForm) => {
      const { error } = await (supabase as any)
        .from('divulgador_welcome_config')
        .insert([{ ...formData, group_id: formData.group_id || null }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      toast.success(welcomeForm.message_type === 'join' ? 'Mensagem de entrada salva!' : 'Mensagem de saída salva!');
      setWelcomeForm({ group_id: '', message: '', is_active: true, delay_seconds: 5, message_type: 'join' });
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const updateWelcomeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof welcomeForm> }) => {
      const { error } = await (supabase as any)
        .from('divulgador_welcome_config')
        .update({ ...data, group_id: data.group_id || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      toast.success('Template atualizado!');
      setEditingWelcome(null);
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const duplicateWelcomeMutation = useMutation({
    mutationFn: async ({ original, newGroupId }: { original: any; newGroupId: string }) => {
      const { error } = await (supabase as any)
        .from('divulgador_welcome_config')
        .insert([{
          message: original.message,
          message_type: original.message_type,
          is_active: original.is_active,
          delay_seconds: original.delay_seconds,
          group_id: newGroupId || null,
          campaign_id: original.campaign_id || null,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-welcome'] });
      toast.success('Template duplicado!');
      setDuplicatingWelcome(null);
      setDuplicateWelcomeGroupId('');
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

  // ================== REALTIME UPDATES ==================
  
  useEffect(() => {
    // Subscribe to realtime updates for participants
    const participantsChannel = supabase
      .channel('divulgador-participants-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'divulgador_participants' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['divulgador-participants'] });
        }
      )
      .subscribe();

    // Subscribe to realtime updates for groups
    const groupsChannel = supabase
      .channel('divulgador-groups-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'divulgador_groups' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(groupsChannel);
    };
  }, [queryClient]);

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
                <h1 className="text-2xl font-bold text-foreground">{t('broadcaster.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('broadcaster.subtitle')}</p>
              </div>
            </div>
          </div>
          <Badge variant={activeInstances > 0 ? "default" : "secondary"} className="gap-1.5">
            {activeInstances > 0 ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {activeInstances} {activeInstances === 1 ? t('broadcaster.instances').slice(0, -1) : t('broadcaster.instances').toLowerCase()}
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
                  <p className="text-xs text-muted-foreground">{t('broadcaster.instances')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('broadcaster.campaigns')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('broadcaster.groups')} ({activeGroups})</p>
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
                  <p className="text-xs text-muted-foreground">{pendingMessages} {t('broadcaster.pending')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('broadcaster.participants')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto -mx-2 px-2 pb-1">
            <TabsList className="inline-grid grid-cols-8 w-max min-w-full h-auto p-1">
              <TabsTrigger value="instances" className="gap-2 py-2"><Wifi className="h-4 w-4" /><span className="hidden sm:inline">WhatsApp</span></TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-2 py-2"><Target className="h-4 w-4" /><span className="hidden sm:inline">{t('broadcaster.campaigns')}</span></TabsTrigger>
              <TabsTrigger value="groups" className="gap-2 py-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">{t('broadcaster.groups')}</span></TabsTrigger>
              <TabsTrigger value="messages" className="gap-2 py-2"><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">{t('broadcaster.messages')}</span></TabsTrigger>
              <TabsTrigger value="polls" className="gap-2 py-2"><BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">{t('broadcaster.polls')}</span></TabsTrigger>
              <TabsTrigger value="welcome" className="gap-2 py-2"><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">{t('broadcaster.welcome')}</span></TabsTrigger>
              <TabsTrigger value="participants" className="gap-2 py-2"><UserMinus className="h-4 w-4" /><span className="hidden sm:inline">{t('broadcaster.participants')}</span></TabsTrigger>
              <TabsTrigger value="logs" className="gap-2 py-2"><FileText className="h-4 w-4" /><span className="hidden sm:inline">{t('broadcaster.logs')}</span></TabsTrigger>
            </TabsList>
          </div>

          {/* TAB: INSTÂNCIAS WHATSAPP */}
          <TabsContent value="instances" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Configuração WhatsApp</h2>
                <p className="text-sm text-muted-foreground">Gerencie instâncias Evolution API e automações</p>
              </div>
            </div>

            {/* Instâncias */}
            <Card className="border-border/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Wifi className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Instâncias WhatsApp</CardTitle>
                      <CardDescription>Números Evolution API para envio de mensagens</CardDescription>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => { setEditingInstance(null); setInstanceForm({ instance_name: '', api_url: '', api_key: '' }); setIsInstanceDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />Nova Instância
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingInstances ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : instances.length === 0 ? (
                  <div className="text-center py-6">
                    <WifiOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma instância configurada</p>
                    <p className="text-xs text-muted-foreground mt-1">Adicione uma instância para começar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {instances.map((inst: any) => (
                      <div key={inst.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${inst.is_connected ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                            {inst.is_connected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div>
                            <p className="font-medium">{inst.instance_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{inst.api_url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={inst.is_connected ? "default" : "secondary"} className="gap-1">
                            {inst.is_connected ? 'Conectado' : 'Desconectado'}
                          </Badge>
                          <Switch
                            checked={inst.is_active}
                            onCheckedChange={(checked) => toggleInstanceMutation.mutate({ id: inst.id, is_active: checked })}
                          />
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => testConnection(inst)} disabled={testingInstanceId === inst.id} title="Testar conexão">
                              {testingInstanceId === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => checkWebhookStatus(inst)} 
                              disabled={checkingWebhookId === inst.id}
                              title="Verificar Webhook"
                              className="text-muted-foreground hover:text-amber-500"
                            >
                              {checkingWebhookId === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingInstance(inst);
                              setInstanceForm({ instance_name: inst.instance_name, api_url: inst.api_url, api_key: inst.api_key });
                              setIsInstanceDialogOpen(true);
                            }} title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setInstanceToDelete(inst)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grid com CRON e Participante Padrão */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* CRON Configuration */}
              <CronConfigCard />

              {/* Default Participant Config */}
              <Card className="border-border/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Participante Padrão</CardTitle>
                      <CardDescription>Número inicial ao criar grupos</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={defaultParticipant}
                      onChange={(e) => setDefaultParticipant(e.target.value)}
                      placeholder="Ex: 5511999999999"
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => saveDefaultParticipantMutation.mutate(defaultParticipant)}
                      disabled={saveDefaultParticipantMutation.isPending || !defaultParticipant}
                    >
                      {saveDefaultParticipantMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inclua o código do país (55 para Brasil).
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Webhook Status Modal */}
            <Dialog open={!!webhookStatus} onOpenChange={(open) => { if (!open) setWebhookStatus(null); }}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Diagnóstico do Webhook{webhookStatus?.instanceName ? ` — ${webhookStatus.instanceName}` : ''}
                  </DialogTitle>
                  <DialogDescription>
                    O webhook é uma configuração na sua instância da Evolution API para avisar o nosso backend quando alguém entra/sai do grupo.
                  </DialogDescription>
                </DialogHeader>

                {webhookStatus && (
                  <div className="space-y-4">
                    <div className={`rounded-lg border p-3 ${webhookStatus.isConfigured && webhookStatus.hasGroupEvent ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                      <div className="text-sm">
                        {webhookStatus.isConfigured && webhookStatus.hasGroupEvent
                          ? 'Webhook configurado corretamente.'
                          : 'Webhook precisa ser configurado (ou está com eventos/URL incorretos).'}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3 p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">URL Atual:</span>
                        <span className={`font-mono text-xs truncate max-w-[380px] ${webhookStatus.currentUrl === webhookStatus.expectedUrl ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {webhookStatus.currentUrl || 'Não configurado'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">URL Esperada:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs truncate max-w-[320px]">{webhookStatus.expectedUrl}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                              __copyToClipboard(webhookStatus.expectedUrl);
                              toast.success('URL copiada!');
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">Eventos configurados:</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {webhookStatus.events?.length > 0 ? webhookStatus.events.map((e: string) => (
                            <Badge key={e} variant="outline" className="text-xs">
                              {e}
                            </Badge>
                          )) : <span className="text-amber-500">Nenhum</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground">Evento GROUP_PARTICIPANTS_UPDATE:</span>
                        <Badge variant={webhookStatus.hasGroupEvent ? 'default' : 'destructive'}>
                          {webhookStatus.hasGroupEvent ? 'Ativo' : 'Não configurado'}
                        </Badge>
                      </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" onClick={() => setWebhookStatus(null)} disabled={isReconfiguringWebhook}>
                        Fechar
                      </Button>

                      {!webhookStatus.isConfigured || !webhookStatus.hasGroupEvent ? (
                        <Button
                          disabled={isReconfiguringWebhook}
                          onClick={async () => {
                            const instance = instances.find((i: any) => i.id === webhookStatus.instanceId);
                            if (instance) {
                              setIsReconfiguringWebhook(true);
                              try {
                                await configureWebhook(instance);
                                toast.success('Webhook reconfigurado! Clique em verificar novamente.');
                                setWebhookStatus(null);
                              } finally {
                                setIsReconfiguringWebhook(false);
                              }
                            }
                          }}
                        >
                          {isReconfiguringWebhook ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                          {isReconfiguringWebhook ? 'Configurando...' : 'Configurar/Reconfigurar'}
                        </Button>
                      ) : null}
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Info Card */}
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600 dark:text-amber-400">Como funciona?</p>
                    <p className="text-muted-foreground mt-1">
                      Ao adicionar uma instância, o webhook é configurado automaticamente para detectar novos participantes. 
                      O CRON processa mensagens agendadas automaticamente no intervalo configurado.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
            <div className="flex flex-col gap-4">
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
                  <Button onClick={() => { 
                    const connectedInstances = instances.filter((i: any) => i.is_connected);
                    setGroupForm({ 
                      name: '', 
                      description: '', 
                      campaign_id: '', 
                      initial_participant: defaultParticipant,
                      instance_id: connectedInstances.length === 1 ? connectedInstances[0].id : '',
                      photo_url: '',
                      admin_only: false,
                    });
                    setIsGroupDialogOpen(true); 
                  }} disabled={instances.length === 0 || !instances.some((i: any) => i.is_connected)}>
                    <Plus className="h-4 w-4 mr-2" />Criar Grupo
                  </Button>
                </div>
              </div>
              
              {/* Campo de pesquisa de grupos */}
              {groups.length > 0 && (
                <div className="relative max-w-sm">
                  <Input
                    placeholder="Pesquisar grupos..."
                    value={groupSearchTerm}
                    onChange={(e) => setGroupSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              )}
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
                  <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Foto</TableHead>
                          <TableHead className="min-w-[120px]">Nome</TableHead>
                          <TableHead className="min-w-[140px]">Instância</TableHead>
                          <TableHead className="w-[100px]">Participantes</TableHead>
                          <TableHead className="w-[100px]">Permissões</TableHead>
                          <TableHead className="w-[100px]">Link</TableHead>
                          <TableHead className="w-[80px]">Status</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groups
                          .filter((group: any) => 
                            groupSearchTerm === '' || 
                            group.name?.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
                            group.divulgador_instances?.instance_name?.toLowerCase().includes(groupSearchTerm.toLowerCase())
                          )
                          .map((group: any) => (
                          <TableRow key={group.id}>
                            <TableCell>
                              <Avatar className="h-8 w-8">
                                {group.photo_url ? (
                                  <AvatarImage src={group.photo_url} alt={group.name} />
                                ) : null}
                                <AvatarFallback className="bg-muted">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="font-medium max-w-[150px] truncate" title={group.name}>{group.name}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {group.divulgador_instances?.instance_name ? (
                                  <Badge variant="outline" className="gap-1">
                                    <Wifi className="h-3 w-3" />
                                    {group.divulgador_instances.instance_name}
                                  </Badge>
                                ) : '-'}
                                {(() => {
                                  const isCommunityGroup = group.whatsapp_group_id?.includes('@newsletter') || 
                                                          group.whatsapp_group_id?.includes('community') ||
                                                          group.name?.toLowerCase().includes('canal');
                                  return (
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] gap-0.5 cursor-help ${isCommunityGroup ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                                      title={isCommunityGroup ? 'Este é um canal/comunidade do WhatsApp' : 'Este é um grupo comum do WhatsApp'}
                                    >
                                      <Users className="h-2.5 w-2.5" />
                                      {isCommunityGroup ? 'Comunidade' : 'Grupo'}
                                    </Badge>
                                  );
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>{group.participant_count}</TableCell>
                            <TableCell className="max-w-[120px]">
                              <div 
                                className="flex gap-1 cursor-help"
                                title={`Enviar: ${group.announce ? 'Só Admins' : 'Todos'}\nEditar: ${group.restrict ? 'Só Admins' : 'Todos'}`}
                              >
                                <Badge 
                                  variant={group.announce ? "default" : "outline"} 
                                  className={`text-[10px] px-1 py-0 gap-0.5 ${group.announce ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : ''}`}
                                >
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  {group.announce ? 'Adm' : 'Tds'}
                                </Badge>
                                <Badge 
                                  variant={group.restrict ? "default" : "outline"} 
                                  className={`text-[10px] px-1 py-0 gap-0.5 ${group.restrict ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : ''}`}
                                >
                                  <Edit className="h-2.5 w-2.5" />
                                  {group.restrict ? 'Adm' : 'Tds'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              {group.invite_link ? (
                                <Button variant="ghost" size="sm" onClick={() => { __copyToClipboard(group.invite_link); toast.success('Link copiado!'); }}>
                                  <Copy className="h-3 w-3 mr-1" />Copiar
                                </Button>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => generateInviteLink(group)}
                                  disabled={isGeneratingLink === group.id}
                                >
                                  {isGeneratingLink === group.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                  )}
                                  Gerar Link
                                </Button>
                              )}
                            </TableCell>
                            <TableCell><Badge variant={group.is_active ? "default" : "secondary"}>{group.is_active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    setQuickMessageGroup(group);
                                    setQuickMessageForm({ content: '', mention_all: false, media_type: 'text', media_url: '' });
                                    setIsQuickMessageDialogOpen(true);
                                  }}
                                  title="Enviar mensagem"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openEditGroupDialog(group)} 
                                  title="Editar grupo"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => generateInviteLink(group)}
                                  disabled={isGeneratingLink === group.id}
                                  title="Gerar/atualizar link"
                                >
                                  {isGeneratingLink === group.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB: MENSAGENS */}
          <TabsContent value="messages" className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
              <div>
                <h2 className="text-lg font-semibold">Mensagens Agendadas</h2>
                <p className="text-sm text-muted-foreground">Agende mensagens para envio aos grupos das campanhas</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={syncGroupsFromWhatsApp} disabled={isSyncing || instances.length === 0 || !instances.some((i: any) => i.is_connected)}>
                  {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar Grupos
                </Button>
                <Button variant="outline" onClick={sendPendingMessages} disabled={isSendingMessages || pendingMessages === 0}>
                  {isSendingMessages ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar Agora ({pendingMessages})
                </Button>
                <Button onClick={() => setIsMessageDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Mensagem</Button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-sm text-muted-foreground">Status:</Label>
                <Select value={messagesStatusFilter} onValueChange={setMessagesStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    <SelectItem value="failed">Com erro</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="text-sm text-muted-foreground">Filtrar por grupo:</Label>
                <Select value={messagesFilterGroup} onValueChange={setMessagesFilterGroup}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todos os grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os grupos</SelectItem>
                    {groups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                          <TableHead>Destino</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Agendamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {messages.filter((msg: any) => {
                          const matchesGroup = messagesFilterGroup === '_all' || msg.group_id === messagesFilterGroup;
                          const matchesStatus = messagesStatusFilter === '_all' || msg.status === messagesStatusFilter;
                          return matchesGroup && matchesStatus;
                        }).map((msg: any) => (
                          <TableRow key={msg.id}>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate" title={msg.content}>{msg.content}</div>
                              {msg.mention_all && (
                                <Badge variant="outline" className="mt-1 text-[10px] gap-0.5">
                                  <Users className="h-2.5 w-2.5" />@todos
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {msg.divulgador_groups?.name ? (
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-sm truncate max-w-[150px]" title={msg.divulgador_groups.name}>
                                    {msg.divulgador_groups.name}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] w-fit gap-0.5 bg-blue-500/10 text-blue-400 border-blue-500/30">
                                    <Target className="h-2.5 w-2.5" />Grupo específico
                                  </Badge>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-sm">Todos os grupos</span>
                                  <Badge variant="outline" className="text-[10px] w-fit gap-0.5 bg-purple-500/10 text-purple-400 border-purple-500/30">
                                    <Users className="h-2.5 w-2.5" />Broadcast
                                  </Badge>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="gap-1">
                                  {msg.media_type === 'image' && <Image className="h-3 w-3" />}
                                  {msg.media_type === 'video' && <Video className="h-3 w-3" />}
                                  {msg.media_type === 'audio' && <Music className="h-3 w-3" />}
                                  {msg.media_type === 'document' && <FileText className="h-3 w-3" />}
                                  {msg.media_type === 'poll' && <BarChart2 className="h-3 w-3" />}
                                  {(msg.media_type === 'text' || !msg.media_type) && <MessageSquare className="h-3 w-3" />}
                                  {msg.media_type || 'text'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  onClick={() => setPreviewMessage(msg)}
                                  title="Visualizar como no WhatsApp"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-sm">
                                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                  {msg.scheduled_at ? formatFromUtc(msg.scheduled_at, 'dd/MM/yyyy') : '-'}
                                </div>
                                {msg.scheduled_at && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatFromUtc(msg.scheduled_at, 'HH:mm')}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {msg.status === 'sent' ? (
                                <Badge className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                  <CheckCircle2 className="h-3 w-3" />Enviado
                                </Badge>
                              ) : msg.status === 'resolved' ? (
                                <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                  <CheckCircle2 className="h-3 w-3" />Resolvido
                                </Badge>
                              ) : msg.status === 'failed' ? (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />Falhou
                                </Badge>
                              ) : msg.status === 'sending' ? (
                                <Badge className="gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
                                  <Loader2 className="h-3 w-3 animate-spin" />Enviando
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                                  <Clock className="h-3 w-3" />Pendente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {(msg.status === 'pending' || msg.status === 'failed') && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-muted-foreground hover:text-primary"
                                    onClick={() => {
                                      setRescheduleMessage(msg);
                                      setRescheduleDateTime('');
                                    }}
                                    title="Reagendar"
                                  >
                                    <CalendarIcon className="h-4 w-4" />
                                  </Button>
                                )}
                                {msg.status === 'pending' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-muted-foreground hover:text-blue-500"
                                    onClick={() => {
                                      setEditingMessage(msg);
                                      setEditMessageForm({
                                        content: msg.content || '',
                                        scheduled_at: msg.scheduled_at ? format(new Date(msg.scheduled_at), "yyyy-MM-dd'T'HH:mm") : '',
                                        media_type: msg.media_type || 'text',
                                        media_url: msg.media_url || '',
                                        mention_all: !!msg.mention_all,
                                        delay_seconds: msg.delay_seconds ?? 2,
                                        poll_options: Array.isArray(msg.poll_options) && msg.poll_options.length > 0 ? msg.poll_options : ['', '', ''],
                                        poll_selectable_count: msg.poll_selectable_count ?? 1,
                                        campaign_id: msg.group_id || '',
                                      });
                                    }}
                                    title="Editar"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-emerald-500"
                                  onClick={() => {
                                    setDuplicateMessage(msg);
                                    setDuplicateDateTime('');
                                  }}
                                  title="Duplicar"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                {msg.status === 'failed' && msg.resolution !== 'resolved' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-muted-foreground hover:text-emerald-500"
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from('divulgador_messages')
                                        .update({ status: 'resolved', resolution: 'resolved' })
                                        .eq('id', msg.id);
                                      
                                      if (error) {
                                        toast.error('Erro ao resolver: ' + error.message);
                                      } else {
                                        toast.success('Mensagem marcada como resolvida!');
                                        queryClient.invalidateQueries({ queryKey: ['divulgador-messages'] });
                                      }
                                    }}
                                    title="Marcar como Resolvido"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMessageMutation.mutate(msg.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>

                              </div>
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

          {/* TAB: RESULTADOS DE ENQUETES */}
          <TabsContent value="polls" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Resultados das Enquetes</h2>
              <p className="text-sm text-muted-foreground">Acompanhe os votos recebidos em cada enquete enviada</p>
            </div>
            
            <PollResultsHistory />
          </TabsContent>

          {/* TAB: MENSAGENS AUTOMÁTICAS (ENTRADA/SAÍDA) */}
          <TabsContent value="welcome" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Mensagens Automáticas</h2>
                <p className="text-sm text-muted-foreground">Configure mensagens enviadas no privado quando participantes entram ou saem dos grupos</p>
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
                      <p className="text-muted-foreground mt-1">Configure uma instância WhatsApp na aba "WhatsApp" para sincronizar grupos e configurar mensagens automáticas.</p>
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
              <Card className={`border-border/40 ${welcomeForm.message_type === 'leave' ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {welcomeForm.message_type === 'leave' ? (
                      <><UserMinus className="h-4 w-4 text-red-500" /> Nova Mensagem de Saída</>
                    ) : (
                      <><Sparkles className="h-4 w-4 text-emerald-500" /> Nova Mensagem de Entrada</>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Evento</Label>
                    <Select value={welcomeForm.message_type} onValueChange={(v: 'join' | 'leave') => setWelcomeForm({ ...welcomeForm, message_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="join">Entrada no grupo (Boas-vindas)</SelectItem>
                        <SelectItem value="leave">Saída do grupo (Despedida)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {welcomeForm.message_type === 'join' 
                        ? 'Mensagem enviada quando alguém entra no grupo' 
                        : 'Mensagem enviada quando alguém sai do grupo'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <Select value={welcomeForm.group_id || "_all"} onValueChange={(v) => setWelcomeForm({ ...welcomeForm, group_id: v === "_all" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">Todos os grupos</SelectItem>
                        {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea 
                      rows={4} 
                      value={welcomeForm.message} 
                      onChange={(e) => setWelcomeForm({ ...welcomeForm, message: e.target.value })} 
                      placeholder={welcomeForm.message_type === 'join' 
                        ? "Olá {nome}! Bem-vindo ao grupo {grupo}..." 
                        : "Até mais {nome}! Sentiremos sua falta no grupo {grupo}..."
                      } 
                    />
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
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {welcomeConfigs.map((wc: any) => (
                          <div key={wc.id} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge variant={wc.is_active ? 'default' : 'secondary'}>{wc.is_active ? 'Ativo' : 'Inativo'}</Badge>
                                  <Badge variant={wc.message_type === 'leave' ? 'destructive' : 'outline'} className={wc.message_type === 'leave' ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}>
                                    {wc.message_type === 'leave' ? 'Saída' : 'Entrada'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm font-medium truncate">{wc.divulgador_groups?.name || 'Todos os grupos'}</span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">{wc.message}</p>
                                <p className="text-xs text-muted-foreground mt-1">Delay: {wc.delay_seconds}s</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-blue-500"
                                  onClick={() => setEditingWelcome(wc)}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-emerald-500"
                                  onClick={() => {
                                    setDuplicatingWelcome(wc);
                                    setDuplicateWelcomeGroupId('');
                                  }}
                                  title="Duplicar para outro grupo"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive" 
                                  onClick={() => deleteWelcomeMutation.mutate(wc.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
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
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Agendar Mensagem</DialogTitle>
              <DialogDescription>Agende uma mensagem para envio aos grupos selecionados</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 px-1">
              <div className="space-y-2">
                <Label>Grupo de destino</Label>
                <Select value={messageForm.campaign_id || "_all"} onValueChange={(v) => setMessageForm({ ...messageForm, campaign_id: v === "_all" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Todos os grupos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os grupos</SelectItem>
                    {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Selecione um grupo específico ou "Todos" para enviar para todos os grupos sincronizados</p>
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
                    <SelectItem value="poll">Enquete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea rows={4} value={messageForm.content} onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })} placeholder="Digite a mensagem..." />
              </div>
              {messageForm.media_type === 'poll' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label>Opções da enquete</Label>
                    <p className="text-xs text-muted-foreground">Mínimo 2 opções, máximo 12</p>
                    <div className="space-y-2">
                      {messageForm.poll_options.map((option, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...messageForm.poll_options];
                              newOptions[index] = e.target.value;
                              setMessageForm({ ...messageForm, poll_options: newOptions });
                            }}
                            placeholder={`Opção ${index + 1}`}
                          />
                          {messageForm.poll_options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newOptions = messageForm.poll_options.filter((_, i) => i !== index);
                                setMessageForm({ ...messageForm, poll_options: newOptions });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {messageForm.poll_options.length < 12 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setMessageForm({ ...messageForm, poll_options: [...messageForm.poll_options, ''] })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar opção
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade de respostas permitidas</Label>
                    <Select 
                      value={String(messageForm.poll_selectable_count)} 
                      onValueChange={(v) => setMessageForm({ ...messageForm, poll_selectable_count: parseInt(v) })}
                    >
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (resposta única)</SelectItem>
                        <SelectItem value="2">Até 2 respostas</SelectItem>
                        <SelectItem value="3">Até 3 respostas</SelectItem>
                        <SelectItem value="0">Múltiplas respostas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {messageForm.media_type !== 'text' && messageForm.media_type !== 'poll' && (
                <div className="space-y-2">
                  <Label>Arquivo de mídia</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={messageForm.media_url} 
                      onChange={(e) => setMessageForm({ ...messageForm, media_url: e.target.value })} 
                      placeholder="URL da mídia ou faça upload abaixo" 
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="media-upload"
                      className="hidden"
                      accept={
                        messageForm.media_type === 'image' ? 'image/*' :
                        messageForm.media_type === 'video' ? 'video/*' :
                        messageForm.media_type === 'audio' ? 'audio/*' :
                        '*'
                      }
                      onChange={handleMediaUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('media-upload')?.click()}
                      disabled={isUploadingMedia}
                    >
                      {isUploadingMedia ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploadingMedia ? 'Enviando...' : 'Upload do computador'}
                    </Button>
                    {messageForm.media_url && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Arquivo carregado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Faça upload de um arquivo do seu computador ou cole uma URL direta.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Data e hora</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`flex-1 justify-start text-left font-normal ${!messageForm.scheduled_at && "text-muted-foreground"}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {messageForm.scheduled_at 
                          ? format(new Date(messageForm.scheduled_at), "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={messageForm.scheduled_at ? new Date(messageForm.scheduled_at) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const currentTime = messageForm.scheduled_at 
                              ? messageForm.scheduled_at.split('T')[1] || '09:00'
                              : '09:00';
                            const newDate = format(date, 'yyyy-MM-dd') + 'T' + currentTime;
                            setMessageForm({ ...messageForm, scheduled_at: newDate });
                          }
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <Input 
                    type="time" 
                    className="w-28"
                    value={messageForm.scheduled_at ? messageForm.scheduled_at.split('T')[1]?.substring(0, 5) || '' : ''} 
                    onChange={(e) => {
                      const currentDate = messageForm.scheduled_at 
                        ? messageForm.scheduled_at.split('T')[0]
                        : format(new Date(), 'yyyy-MM-dd');
                      setMessageForm({ ...messageForm, scheduled_at: currentDate + 'T' + e.target.value });
                    }} 
                  />
                </div>
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
            </ScrollArea>
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Novo Grupo</DialogTitle>
              <DialogDescription>O grupo será criado via Evolution API na instância selecionada</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Instância WhatsApp <span className="text-destructive">*</span></Label>
                <Select value={groupForm.instance_id || "_none"} onValueChange={(v) => setGroupForm({ ...groupForm, instance_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione...</SelectItem>
                    {instances.filter((i: any) => i.is_connected).map((inst: any) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        <div className="flex items-center gap-2">
                          <Wifi className="h-3 w-3 text-emerald-500" />
                          {inst.instance_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">O grupo será criado no número desta instância</p>
              </div>
              <div className="space-y-2">
                <Label>Nome do Grupo <span className="text-destructive">*</span></Label>
                <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Ex: Lembrete de Demanda #1" />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea rows={2} value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} placeholder="Descrição do grupo" />
              </div>
              <div className="space-y-2">
                <Label>Foto do Grupo (opcional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="group-photo-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleGroupPhotoUpload(e, false)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('group-photo-upload')?.click()}
                    disabled={isUploadingGroupPhoto}
                  >
                    {isUploadingGroupPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {isUploadingGroupPhoto ? 'Enviando...' : 'Upload foto'}
                  </Button>
                  {groupForm.photo_url && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Foto carregada
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Participante Inicial <span className="text-destructive">*</span>
                  {defaultParticipant && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Lock className="h-3 w-3" />
                      Padrão configurado
                    </Badge>
                  )}
                </Label>
                <Input 
                  value={groupForm.initial_participant} 
                  onChange={(e) => setGroupForm({ ...groupForm, initial_participant: e.target.value })} 
                  placeholder="Ex: 5511999999999"
                  disabled={!!defaultParticipant}
                  className={defaultParticipant ? 'bg-muted' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  {defaultParticipant 
                    ? 'Utilizando participante padrão configurado na aba WhatsApp.' 
                    : 'Número WhatsApp com código do país e DDD. Obrigatório para criar grupo via API.'}
                </p>
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
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={groupForm.admin_only} onCheckedChange={(c) => setGroupForm({ ...groupForm, admin_only: c })} />
                <Label>Somente admins podem enviar mensagens</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>Cancelar</Button>
              <Button onClick={createGroupViaAPI} disabled={isCreatingGroup || !groupForm.name || !groupForm.initial_participant || !groupForm.instance_id}>
                {isCreatingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar Grupo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar Grupo */}
        <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Editar Grupo</DialogTitle>
              <DialogDescription>Altere as configurações do grupo "{editingGroup?.name}"</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                {isLoadingGroupSettings && (
                  <div className="flex items-center justify-center py-4 text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando configurações do WhatsApp...
                  </div>
                )}
                {isCommunity && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-600 dark:text-amber-400">Este é um grupo de comunidade</p>
                          <p className="text-muted-foreground mt-1">Comunidades não podem ser editadas a menos que você seja administrador dela. Apenas visualização disponível.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div className="space-y-2">
                  <Label>Nome do Grupo</Label>
                  <Input 
                    value={editGroupForm.name} 
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })} 
                    placeholder="Nome do grupo" 
                    disabled={isCommunity}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea 
                    rows={2} 
                    value={editGroupForm.description} 
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, description: e.target.value })} 
                    placeholder="Descrição do grupo"
                    disabled={isCommunity}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Foto do Grupo</Label>
                  {isLoadingGroupSettings ? (
                    <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                      <span className="text-sm text-muted-foreground">Carregando foto do grupo...</span>
                    </div>
                  ) : (editingGroup?.photo_url || editGroupForm.photo_url) && (
                    <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={editGroupForm.photo_url || editingGroup?.photo_url} alt="Foto atual" />
                        <AvatarFallback><Users className="h-6 w-6" /></AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        {editGroupForm.photo_url ? 'Nova foto carregada' : 'Foto atual do grupo'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="edit-group-photo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleGroupPhotoUpload(e, true)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('edit-group-photo-upload')?.click()}
                      disabled={isUploadingGroupPhoto || isCommunity}
                    >
                      {isUploadingGroupPhoto ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploadingGroupPhoto ? 'Enviando...' : 'Alterar foto'}
                    </Button>
                    {editGroupForm.photo_url && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Nova foto carregada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Deixe em branco para manter a foto atual</p>
                </div>
                {/* Permissões do Grupo */}
                <Card className="border-border/50">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Permissões do Grupo
                      {isLoadingGroupSettings && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 px-4 space-y-4">
                    {/* Quem pode enviar mensagens */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Enviar Mensagens</Label>
                        <p className="text-xs text-muted-foreground">
                          {editGroupForm.admin_only ? 'Somente administradores' : 'Todos os membros'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={editGroupForm.admin_only ? "default" : "secondary"} className="text-xs">
                          {editGroupForm.admin_only ? 'Admins' : 'Todos'}
                        </Badge>
                        <Switch 
                          checked={editGroupForm.admin_only} 
                          onCheckedChange={(c) => setEditGroupForm({ ...editGroupForm, admin_only: c })}
                          disabled={isLoadingGroupSettings || isCommunity}
                        />
                      </div>
                    </div>
                    
                    {/* Quem pode editar informações */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Editar Informações</Label>
                        <p className="text-xs text-muted-foreground">
                          {editGroupForm.locked ? 'Somente administradores' : 'Todos os membros'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={editGroupForm.locked ? "default" : "secondary"} className="text-xs">
                          {editGroupForm.locked ? 'Admins' : 'Todos'}
                        </Badge>
                        <Switch 
                          checked={editGroupForm.locked} 
                          onCheckedChange={(c) => setEditGroupForm({ ...editGroupForm, locked: c })}
                          disabled={isLoadingGroupSettings || isCommunity}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="py-3">
                    <p className="text-xs text-muted-foreground">
                      <Info className="h-3 w-3 inline mr-1" />
                      As alterações serão aplicadas diretamente no WhatsApp via Evolution API
                    </p>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditGroupDialogOpen(false)}>
                {isCommunity ? 'Fechar' : 'Cancelar'}
              </Button>
              {!isCommunity && (
                <Button onClick={updateGroupViaAPI} disabled={isUpdatingGroup || !editGroupForm.name || isLoadingGroupSettings}>
                  {isUpdatingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Alterações
                </Button>
              )}
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
                        <li>Remover participantes e configurações de mensagens automáticas</li>
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

        {/* Dialog: Envio Rápido de Mensagem */}
        <Dialog open={isQuickMessageDialogOpen} onOpenChange={setIsQuickMessageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Enviar Mensagem para {quickMessageGroup?.name}
              </DialogTitle>
              <DialogDescription>
                Envie uma mensagem diretamente para este grupo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Tipo de mídia */}
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select 
                  value={quickMessageForm.media_type} 
                  onValueChange={(v) => setQuickMessageForm({ ...quickMessageForm, media_type: v, media_url: '' })}
                >
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
                <Label>Mensagem</Label>
                <Textarea 
                  rows={4} 
                  value={quickMessageForm.content} 
                  onChange={(e) => setQuickMessageForm({ ...quickMessageForm, content: e.target.value })} 
                  placeholder="Digite a mensagem..." 
                />
              </div>
              
              {/* Upload de mídia */}
              {quickMessageForm.media_type !== 'text' && (
                <div className="space-y-2">
                  <Label>Arquivo de Mídia</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={quickMessageForm.media_url} 
                      onChange={(e) => setQuickMessageForm({ ...quickMessageForm, media_url: e.target.value })} 
                      placeholder="URL da mídia ou faça upload abaixo" 
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="quick-media-upload"
                      className="hidden"
                      accept={
                        quickMessageForm.media_type === 'image' ? 'image/*' :
                        quickMessageForm.media_type === 'video' ? 'video/*' :
                        quickMessageForm.media_type === 'audio' ? 'audio/*' :
                        '*'
                      }
                      onChange={handleQuickMediaUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('quick-media-upload')?.click()}
                      disabled={isUploadingQuickMedia}
                    >
                      {isUploadingQuickMedia ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploadingQuickMedia ? 'Enviando...' : 'Upload'}
                    </Button>
                    {quickMessageForm.media_url && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Arquivo carregado
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Switch 
                  checked={quickMessageForm.mention_all} 
                  onCheckedChange={(c) => setQuickMessageForm({ ...quickMessageForm, mention_all: c })} 
                />
                <Label>Mencionar todos os participantes</Label>
              </div>
              {quickMessageForm.mention_all && (
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="py-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Todos os membros do grupo serão mencionados na mensagem
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsQuickMessageDialogOpen(false)}>Cancelar</Button>
              <Button onClick={sendQuickMessage} disabled={isSendingQuickMessage || !quickMessageForm.content}>
                {isSendingQuickMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar Agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Debug da API */}
        <Dialog open={isApiDebugDialogOpen} onOpenChange={setIsApiDebugDialogOpen}>
          <DialogContent className="w-[min(92vw,48rem)] max-w-none">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes da Resposta da API
              </DialogTitle>
              <DialogDescription>
                Informações de debug das chamadas à Evolution API
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              {apiDebugResponse && (
                <div className="space-y-4">
                  {/* Header Info */}
                  <Card className="border-border/50">
                    <CardContent className="py-3 space-y-2">
                      <div className="grid grid-cols-[auto,1fr] items-center gap-x-4 gap-y-2">
                        <span className="text-sm font-medium">Ação:</span>
                        <div className="justify-self-end max-w-full text-right">
                          <code className="text-xs bg-muted px-2 py-1 rounded break-all inline-block max-w-full">{apiDebugResponse.action}</code>
                        </div>

                        {apiDebugResponse.groupName && (
                          <>
                            <span className="text-sm font-medium">Grupo:</span>
                            <span className="text-sm justify-self-end max-w-full break-words text-right">{apiDebugResponse.groupName}</span>
                          </>
                        )}

                        {apiDebugResponse.instance && (
                          <>
                            <span className="text-sm font-medium">Instância:</span>
                            <span className="text-sm justify-self-end max-w-full break-words text-right">{apiDebugResponse.instance}</span>
                          </>
                        )}

                        {apiDebugResponse.groupJid && (
                          <>
                            <span className="text-sm font-medium">Group JID:</span>
                            <code className="text-xs bg-muted px-2 py-1 rounded justify-self-end max-w-full break-all">
                              {apiDebugResponse.groupJid}
                            </code>
                          </>
                        )}

                        <span className="text-sm font-medium">Status Geral:</span>
                        <div className="justify-self-end">
                          {apiDebugResponse.success ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" /> Falha
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* API Responses */}
                  {apiDebugResponse.responses && apiDebugResponse.responses.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Respostas das Chamadas:</h4>
                      {apiDebugResponse.responses.map((resp: any, idx: number) => (
                        <Card key={idx} className={`border-l-4 ${resp.ok ? 'border-l-green-500' : 'border-l-red-500'}`}>
                          <CardContent className="py-3 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-medium text-sm">{resp.label}</span>
                              <Badge variant={resp.ok ? "default" : "destructive"} className="text-xs">
                                {resp.ok ? 'OK' : `Erro ${resp.status || ''}`}
                              </Badge>
                            </div>
                            {(resp.method || resp.endpoint) && (
                              <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded font-mono break-all">
                                <span className="font-semibold text-foreground">{resp.method || 'POST'}</span>{' '}
                                {resp.endpoint || '-'}
                              </div>
                            )}
                            {resp.data && (
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                                {JSON.stringify(resp.data, null, 2)}
                              </pre>
                            )}
                            {resp.error && (
                              <p className="text-xs text-destructive">{resp.error}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Send Message Result */}
                  {apiDebugResponse.result && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Resultado do Envio:</h4>
                      <Card className="border-border/50">
                        <CardContent className="py-3">
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                            {JSON.stringify(apiDebugResponse.result, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApiDebugDialogOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Reagendar Mensagem */}
        <Dialog open={!!rescheduleMessage} onOpenChange={(open) => !open && setRescheduleMessage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Reagendar Mensagem
              </DialogTitle>
              <DialogDescription>
                Escolha uma nova data e horário para enviar esta mensagem
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Conteúdo:</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{rescheduleMessage?.content}</p>
              </div>
              <div className="space-y-2">
                <Label>Nova data e horário</Label>
                <Input
                  type="datetime-local"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleMessage(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (rescheduleMessage && rescheduleDateTime) {
                    rescheduleMessageMutation.mutate({ 
                      id: rescheduleMessage.id, 
                      newDateTime: rescheduleDateTime 
                    });
                  }
                }}
                disabled={!rescheduleDateTime || rescheduleMessageMutation.isPending}
              >
                {rescheduleMessageMutation.isPending ? 'Reagendando...' : 'Reagendar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar Mensagem */}
        <Dialog open={!!editingMessage} onOpenChange={(open) => !open && setEditingMessage(null)}>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Editar Mensagem
              </DialogTitle>
              <DialogDescription>
                Edite todos os campos da mensagem pendente (tipo, mídia, conteúdo, enquete, agendamento)
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 py-4 px-1">
              <div className="space-y-2">
                <Label>Grupo de destino</Label>
                <Select
                  value={editMessageForm.campaign_id || "_all"}
                  onValueChange={(v) => setEditMessageForm({ ...editMessageForm, campaign_id: v === "_all" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Todos os grupos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os grupos</SelectItem>
                    {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de mídia</Label>
                <Select
                  value={editMessageForm.media_type}
                  onValueChange={(v) => setEditMessageForm({ ...editMessageForm, media_type: v, media_url: v === 'text' || v === 'poll' ? '' : editMessageForm.media_url })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="poll">Enquete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{editMessageForm.media_type === 'poll' ? 'Pergunta da enquete' : 'Conteúdo'}</Label>
                <Textarea
                  value={editMessageForm.content}
                  onChange={(e) => setEditMessageForm({ ...editMessageForm, content: e.target.value })}
                  rows={4}
                  placeholder="Conteúdo da mensagem..."
                />
              </div>

              {editMessageForm.media_type === 'poll' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label>Opções da enquete</Label>
                    <p className="text-xs text-muted-foreground">Mínimo 2 opções, máximo 12</p>
                    <div className="space-y-2">
                      {editMessageForm.poll_options.map((option, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...editMessageForm.poll_options];
                              newOptions[index] = e.target.value;
                              setEditMessageForm({ ...editMessageForm, poll_options: newOptions });
                            }}
                            placeholder={`Opção ${index + 1}`}
                          />
                          {editMessageForm.poll_options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newOptions = editMessageForm.poll_options.filter((_, i) => i !== index);
                                setEditMessageForm({ ...editMessageForm, poll_options: newOptions });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {editMessageForm.poll_options.length < 12 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditMessageForm({ ...editMessageForm, poll_options: [...editMessageForm.poll_options, ''] })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar opção
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade de respostas permitidas</Label>
                    <Select
                      value={String(editMessageForm.poll_selectable_count)}
                      onValueChange={(v) => setEditMessageForm({ ...editMessageForm, poll_selectable_count: parseInt(v) })}
                    >
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (resposta única)</SelectItem>
                        <SelectItem value="2">Até 2 respostas</SelectItem>
                        <SelectItem value="3">Até 3 respostas</SelectItem>
                        <SelectItem value="0">Múltiplas respostas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {editMessageForm.media_type !== 'text' && editMessageForm.media_type !== 'poll' && (
                <div className="space-y-2">
                  <Label>Arquivo de mídia</Label>
                  <Input
                    value={editMessageForm.media_url}
                    onChange={(e) => setEditMessageForm({ ...editMessageForm, media_url: e.target.value })}
                    placeholder="URL da mídia ou faça upload abaixo"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="edit-media-upload"
                      className="hidden"
                      accept={
                        editMessageForm.media_type === 'image' ? 'image/*' :
                        editMessageForm.media_type === 'video' ? 'video/*' :
                        editMessageForm.media_type === 'audio' ? 'audio/*' :
                        '*'
                      }
                      onChange={handleEditMediaUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('edit-media-upload')?.click()}
                      disabled={isUploadingEditMedia}
                    >
                      {isUploadingEditMedia ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {isUploadingEditMedia ? 'Enviando...' : 'Substituir arquivo'}
                    </Button>
                    {editMessageForm.media_url && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />Arquivo carregado
                      </Badge>
                    )}
                  </div>
                  {editMessageForm.media_url && editMessageForm.media_type === 'image' && (
                    <img src={editMessageForm.media_url} alt="Preview" className="max-h-40 rounded border" />
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Data e horário de envio</Label>
                <Input
                  type="datetime-local"
                  value={editMessageForm.scheduled_at}
                  onChange={(e) => setEditMessageForm({ ...editMessageForm, scheduled_at: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editMessageForm.mention_all}
                    onCheckedChange={(c) => setEditMessageForm({ ...editMessageForm, mention_all: c })}
                  />
                  <Label>Mencionar todos</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Delay (seg):</Label>
                  <Input
                    type="number"
                    className="w-20"
                    min={1}
                    max={60}
                    value={editMessageForm.delay_seconds}
                    onChange={(e) => setEditMessageForm({ ...editMessageForm, delay_seconds: parseInt(e.target.value) || 2 })}
                  />
                </div>
              </div>
            </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMessage(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!editingMessage) return;
                  if (!editMessageForm.content && editMessageForm.media_type === 'text') {
                    toast.error('Digite o conteúdo da mensagem');
                    return;
                  }
                  if (editMessageForm.media_type === 'poll') {
                    const opts = editMessageForm.poll_options.filter(o => o.trim() !== '');
                    if (opts.length < 2) {
                      toast.error('Enquete precisa de no mínimo 2 opções');
                      return;
                    }
                  }
                  if (editMessageForm.media_type !== 'text' && editMessageForm.media_type !== 'poll' && !editMessageForm.media_url) {
                    toast.error('Adicione um arquivo de mídia');
                    return;
                  }
                  editMessageMutation.mutate({ id: editingMessage.id, form: editMessageForm });
                }}
                disabled={editMessageMutation.isPending}
              >
                {editMessageMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Preview WhatsApp */}
        <Dialog open={!!previewMessage} onOpenChange={(open) => !open && setPreviewMessage(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-0 shadow-2xl">
            <div className="bg-[#0b141a] rounded-lg overflow-hidden">
              {/* Header estilo WhatsApp */}
              <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-black/30">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-emerald-700 text-white">
                    {(previewMessage?.divulgador_groups?.name || 'G').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate text-sm">
                    {previewMessage?.divulgador_groups?.name || 'Todos os grupos'}
                  </p>
                  <p className="text-[11px] text-gray-400">Preview da mensagem</p>
                </div>
              </div>

              {/* Body com pattern estilo WhatsApp */}
              <div
                className="p-4 min-h-[280px]"
                style={{
                  backgroundColor: '#0b141a',
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-[#005c4b] text-white rounded-lg rounded-tr-none shadow p-2 space-y-2">
                    {previewMessage?.mention_all && (
                      <div className="text-[11px] text-emerald-200 font-medium">@todos</div>
                    )}

                    {previewMessage?.media_type === 'image' && previewMessage?.media_url && (
                      <img src={previewMessage.media_url} alt="mídia" className="rounded max-w-full max-h-72 object-contain" />
                    )}

                    {previewMessage?.media_type === 'video' && previewMessage?.media_url && (
                      <video src={previewMessage.media_url} controls className="rounded max-w-full max-h-72" />
                    )}

                    {previewMessage?.media_type === 'audio' && previewMessage?.media_url && (
                      <div className="flex items-center gap-2 bg-[#025144] rounded px-2 py-2 min-w-[240px]">
                        <Music className="h-5 w-5 text-emerald-200" />
                        <audio src={previewMessage.media_url} controls className="flex-1 h-8" />
                      </div>
                    )}

                    {previewMessage?.media_type === 'document' && previewMessage?.media_url && (
                      <a
                        href={previewMessage.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 bg-[#025144] rounded px-3 py-2 min-w-[220px] hover:bg-[#02624f]"
                      >
                        <FileText className="h-6 w-6 text-emerald-200" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">
                            {previewMessage.media_url.split('/').pop() || 'Documento'}
                          </p>
                          <p className="text-[11px] text-emerald-200/70">Abrir arquivo</p>
                        </div>
                      </a>
                    )}

                    {previewMessage?.media_type === 'poll' && Array.isArray(previewMessage?.poll_options) && (
                      <div className="bg-[#025144] rounded p-3 space-y-2 min-w-[260px]">
                        <div className="flex items-center gap-2 text-emerald-200 text-xs">
                          <BarChart2 className="h-4 w-4" />
                          <span>Enquete{previewMessage.poll_selectable_count === 0 ? ' · múltiplas respostas' : previewMessage.poll_selectable_count > 1 ? ` · até ${previewMessage.poll_selectable_count} respostas` : ''}</span>
                        </div>
                        {previewMessage.content && (
                          <p className="text-sm text-white font-medium whitespace-pre-wrap">{previewMessage.content}</p>
                        )}
                        <div className="space-y-1.5">
                          {previewMessage.poll_options.filter((o: string) => o?.trim() !== '').map((opt: string, i: number) => (
                            <div key={i} className="border border-white/20 rounded px-2.5 py-1.5 text-sm text-white flex items-center gap-2">
                              <span className="h-3.5 w-3.5 rounded-full border border-white/50 inline-block" />
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {previewMessage?.content && previewMessage?.media_type !== 'poll' && (
                      <p className="text-sm whitespace-pre-wrap break-words">{previewMessage.content}</p>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[10px] text-gray-300/80">
                      <span>
                        {previewMessage?.scheduled_at
                          ? formatFromUtc(previewMessage.scheduled_at, 'HH:mm')
                          : format(new Date(), 'HH:mm')}
                      </span>
                      <CheckCheck className="h-3 w-3" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <Badge variant="outline" className="bg-black/40 text-gray-300 border-white/10 text-[10px]">
                    Pré-visualização · não enviado
                  </Badge>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Duplicar Mensagem */}
        <Dialog open={!!duplicateMessage} onOpenChange={(open) => !open && setDuplicateMessage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Duplicar Mensagem
              </DialogTitle>
              <DialogDescription>
                Crie uma cópia desta mensagem com uma nova data de envio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Conteúdo:</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{duplicateMessage?.content}</p>
              </div>
              {duplicateMessage?.divulgador_groups?.name && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Grupo destino:</p>
                  <p className="text-sm text-muted-foreground">{duplicateMessage.divulgador_groups.name}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Nova data e horário</Label>
                <Input
                  type="datetime-local"
                  value={duplicateDateTime}
                  onChange={(e) => setDuplicateDateTime(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateMessage(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (duplicateMessage && duplicateDateTime) {
                    duplicateMessageMutation.mutate({ 
                      originalMessage: duplicateMessage, 
                      newDateTime: duplicateDateTime 
                    });
                  }
                }}
                disabled={!duplicateDateTime || duplicateMessageMutation.isPending}
              >
                {duplicateMessageMutation.isPending ? 'Duplicando...' : 'Duplicar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar Template de Mensagem Automática */}
        <Dialog open={!!editingWelcome} onOpenChange={(open) => !open && setEditingWelcome(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Editar Mensagem Automática
              </DialogTitle>
              <DialogDescription>
                Edite o template de mensagem automática
              </DialogDescription>
            </DialogHeader>
            {editingWelcome && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo de Evento</Label>
                  <Select 
                    value={editingWelcome.message_type} 
                    onValueChange={(v) => setEditingWelcome({ ...editingWelcome, message_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="join">Entrada no grupo (Boas-vindas)</SelectItem>
                      <SelectItem value="leave">Saída do grupo (Despedida)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Select 
                    value={editingWelcome.group_id || "_all"} 
                    onValueChange={(v) => setEditingWelcome({ ...editingWelcome, group_id: v === "_all" ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos os grupos</SelectItem>
                      {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={editingWelcome.message}
                    onChange={(e) => setEditingWelcome({ ...editingWelcome, message: e.target.value })}
                    rows={4}
                    placeholder="Mensagem automática..."
                  />
                  <p className="text-xs text-muted-foreground">Use {'{nome}'}, {'{numero}'} ou {'{grupo}'} para personalizar</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={editingWelcome.is_active} 
                      onCheckedChange={(c) => setEditingWelcome({ ...editingWelcome, is_active: c })} 
                    />
                    <Label>Ativo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Delay (seg):</Label>
                    <Input 
                      type="number" 
                      className="w-20" 
                      value={editingWelcome.delay_seconds} 
                      onChange={(e) => setEditingWelcome({ ...editingWelcome, delay_seconds: parseInt(e.target.value) || 5 })} 
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingWelcome(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (editingWelcome) {
                    updateWelcomeMutation.mutate({ 
                      id: editingWelcome.id, 
                      data: {
                        message: editingWelcome.message,
                        message_type: editingWelcome.message_type,
                        group_id: editingWelcome.group_id,
                        is_active: editingWelcome.is_active,
                        delay_seconds: editingWelcome.delay_seconds,
                      }
                    });
                  }
                }}
                disabled={!editingWelcome?.message || updateWelcomeMutation.isPending}
              >
                {updateWelcomeMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Duplicar Template de Mensagem Automática */}
        <Dialog open={!!duplicatingWelcome} onOpenChange={(open) => !open && setDuplicatingWelcome(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Duplicar para Outro Grupo
              </DialogTitle>
              <DialogDescription>
                Crie uma cópia deste template para um grupo específico
              </DialogDescription>
            </DialogHeader>
            {duplicatingWelcome && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={duplicatingWelcome.message_type === 'leave' ? 'destructive' : 'outline'}>
                      {duplicatingWelcome.message_type === 'leave' ? 'Saída' : 'Entrada'}
                    </Badge>
                    <Badge variant="secondary">
                      {duplicatingWelcome.divulgador_groups?.name || 'Todos os grupos'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{duplicatingWelcome.message}</p>
                </div>
                <div className="space-y-2">
                  <Label>Novo Grupo Destino</Label>
                  <Select 
                    value={duplicateWelcomeGroupId || "_all"} 
                    onValueChange={(v) => setDuplicateWelcomeGroupId(v === "_all" ? "" : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Todos os grupos</SelectItem>
                      {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O template será copiado com a mesma mensagem, tipo e configurações para o grupo selecionado
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicatingWelcome(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (duplicatingWelcome) {
                    duplicateWelcomeMutation.mutate({ 
                      original: duplicatingWelcome, 
                      newGroupId: duplicateWelcomeGroupId 
                    });
                  }
                }}
                disabled={duplicateWelcomeMutation.isPending}
              >
                {duplicateWelcomeMutation.isPending ? 'Duplicando...' : 'Duplicar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
