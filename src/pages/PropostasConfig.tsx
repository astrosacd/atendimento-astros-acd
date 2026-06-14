import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Mail, MessageSquare, Save, Loader2, Eye, EyeOff, Palette, RefreshCcw, Info, Bell, Webhook, Plus, Trash2, Clock, Database, Search, Mic } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useProposalSendConfig } from '@/hooks/useProposalSending';
import { BrandingConfig } from '@/components/proposals/BrandingConfig';
import { ElevenLabsCreditsCard } from '@/components/dashboard/ElevenLabsCreditsCard';
import { useElevenLabsCreditsMulti } from '@/hooks/useElevenLabsCreditsMulti';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

const NAV_ITEMS = [
  { value: 'branding', label: 'Identidade Visual', icon: Palette },
  { value: 'email', label: 'Email (Gmail)', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp (Evolution)', icon: MessageSquare },
  { value: 'auto-remarketing', label: 'Remarketing Auto', icon: RefreshCcw },
  { value: 'confirmacoes', label: 'Confirmações', icon: Bell },
  { value: 'webhooks', label: 'Webhooks', icon: Webhook },
  { value: 'baserow', label: 'Baserow', icon: Database },
];

export default function PropostasConfig() {
  const navigate = useNavigate();
  const { config, isLoading, updateConfig } = useProposalSendConfig();
  const { hasPermission } = usePermissions();
  const canViewGhost = hasPermission('configure_proposal_ghost_mode');
  const canViewVoices = hasPermission('configure_proposal_ai_voices');
  const [activeTab, setActiveTab] = useState('branding');
  const elevenLabsMulti = useElevenLabsCreditsMulti(canViewVoices);
  const elevenPropostas = elevenLabsMulti.sources.find((s) => s.source === 'propostas') || null;

  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [gmailSenderName, setGmailSenderName] = useState('');
  const [evolutionApiUrl, setEvolutionApiUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstanceName, setEvolutionInstanceName] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [autoRemarketingEnabled, setAutoRemarketingEnabled] = useState(false);
  const [autoRemarketingMaxDays, setAutoRemarketingMaxDays] = useState(3);
  const [autoRemarketingChannel, setAutoRemarketingChannel] = useState('email');
  const [autoRemarketingCronHour, setAutoRemarketingCronHour] = useState(9);
  
  // Ghost Mode
  const [ghostModeEnabled, setGhostModeEnabled] = useState(false);
  const [ghostModeType, setGhostModeType] = useState<'fixed' | 'dynamic'>('fixed');
  const [ghostViewThreshold, setGhostViewThreshold] = useState(3);
  const [ghostModeDay, setGhostModeDay] = useState(3);
  const [ghostAudioUrl, setGhostAudioUrl] = useState('');
  const [ghostVideoUrl, setGhostVideoUrl] = useState('');
  const [uploadingGhost, setUploadingGhost] = useState<'audio' | 'video' | null>(null);
  // ElevenLabs TTS for Ghost
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb');
  const [showElevenKey, setShowElevenKey] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [ttsPreviewUrl, setTtsPreviewUrl] = useState<string | null>(null);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsSaving, setTtsSaving] = useState(false);
  const [voicesList, setVoicesList] = useState<Array<{ voice_id: string; name: string; category?: string; voice_type?: string; labels?: any; preview_url?: string }>>([]);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [onlyFreeVoices, setOnlyFreeVoices] = useState(true);
  const [voicesAutoSynced, setVoicesAutoSynced] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testClientName, setTestClientName] = useState('João Silva');
  const [testSending, setTestSending] = useState<'audio' | 'video' | null>(null);
  const [ttsLogs, setTtsLogs] = useState<any[]>([]);
  const [loadingTtsLogs, setLoadingTtsLogs] = useState(false);

  const getVoicePlanInfo = (voice: { category?: string; voice_type?: string; labels?: any }) => {
    const category = String(voice.category || '').toLowerCase();
    const voiceType = String(voice.voice_type || '').toLowerCase();
    const labelsText = JSON.stringify(voice.labels || {}).toLowerCase();

    if (voiceType === 'default' || category === 'premade' || category === 'generated') {
      return { label: 'Free / padrão', className: 'border-primary/40 bg-primary/10 text-primary' };
    }

    if (category.includes('professional') || voiceType.includes('professional') || labelsText.includes('professional')) {
      return { label: 'Profissional', className: 'border-destructive/40 bg-destructive/10 text-destructive' };
    }

    if (category.includes('cloned') || voiceType.includes('cloned')) {
      return { label: 'Clonada', className: 'border-accent/40 bg-accent/10 text-accent-foreground' };
    }

    if (category.includes('library')) {
      return { label: 'Biblioteca / pago', className: 'border-destructive/40 bg-destructive/10 text-destructive' };
    }

    return { label: 'Verificar plano', className: 'border-muted-foreground/30 bg-muted text-muted-foreground' };
  };

  // Status notifications
  const [statusNotifEnabled, setStatusNotifEnabled] = useState(false);
  const [acceptEnabled, setAcceptEnabled] = useState(true);
  const [acceptChannel, setAcceptChannel] = useState('whatsapp');
  const [acceptMessageTemplate, setAcceptMessageTemplate] = useState('');
  const [rejectEnabled, setRejectEnabled] = useState(true);
  const [rejectChannel, setRejectChannel] = useState('whatsapp');
  const [rejectMessageTemplate, setRejectMessageTemplate] = useState('');
  const [statusNotifId, setStatusNotifId] = useState<string | null>(null);
  const [isSavingStatusNotif, setIsSavingStatusNotif] = useState(false);
  const [managerNotifyEnabled, setManagerNotifyEnabled] = useState(false);
  const [managerNumbers, setManagerNumbers] = useState<string[]>([]);
  const [managerAcceptMessage, setManagerAcceptMessage] = useState('');
  const [managerRejectMessage, setManagerRejectMessage] = useState('');
  const [newManagerNumber, setNewManagerNumber] = useState('');
  const [managerDelaySeconds, setManagerDelaySeconds] = useState(5);

  // Webhooks
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['proposta.enviada', 'proposta.visualizada', 'proposta.aceita', 'proposta.recusada']);

  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Baserow integration
  const [baserowEnabled, setBaserowEnabled] = useState(false);
  const [baserowApiUrl, setBaserowApiUrl] = useState('');
  const [baserowToken, setBaserowToken] = useState('');
  const [baserowTableId, setBaserowTableId] = useState('');
  const [baserowEvents, setBaserowEvents] = useState<string[]>(['proposta.enviada', 'proposta.aceita', 'proposta.recusada']);
  const [isSavingBaserow, setIsSavingBaserow] = useState(false);
  const [showBaserowToken, setShowBaserowToken] = useState(false);

  useEffect(() => {
    if (config) {
      setGmailUser(config.gmail_user || '');
      setGmailAppPassword(config.gmail_app_password || '');
      setGmailSenderName(config.gmail_sender_name || '');
      setEvolutionApiUrl(config.evolution_api_url || '');
      setEvolutionApiKey(config.evolution_api_key || '');
      setEvolutionInstanceName(config.evolution_instance_name || '');
      setEmailEnabled(config.email_enabled);
      setWhatsappEnabled(config.whatsapp_enabled);
      setAutoRemarketingEnabled(config.auto_remarketing_enabled ?? false);
      setAutoRemarketingMaxDays(config.auto_remarketing_max_days ?? 3);
      setAutoRemarketingChannel(config.auto_remarketing_channel ?? 'email');
      setAutoRemarketingCronHour((config as any).auto_remarketing_cron_hour ?? 9);
      setGhostModeEnabled((config as any).ghost_mode_enabled ?? false);
      setGhostModeType((config as any).ghost_mode_type || 'fixed');
      setGhostViewThreshold((config as any).ghost_view_threshold ?? 3);
      setGhostAudioUrl((config as any).ghost_audio_url || '');
      setGhostVideoUrl((config as any).ghost_video_url || '');
      setElevenlabsApiKey((config as any).elevenlabs_api_key || '');
      setElevenlabsVoiceId((config as any).elevenlabs_voice_id || 'JBFqnCBsd6RMkjVDRZzb');
      setTtsText((config as any).tts_text || '');
    }
  }, [config]);

  // Fetch status notification config
  useEffect(() => {
    async function fetchStatusNotifConfig() {
      const { data } = await supabase
        .from('proposal_status_notifications')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (data) {
        setStatusNotifId(data.id);
        setStatusNotifEnabled(data.enabled ?? false);
        setAcceptEnabled(data.accept_enabled ?? true);
        setAcceptChannel(data.accept_channel || 'whatsapp');
        setAcceptMessageTemplate(data.accept_message_template || '');
        setRejectEnabled(data.reject_enabled ?? true);
        setRejectChannel(data.reject_channel || 'whatsapp');
        setRejectMessageTemplate(data.reject_message_template || '');
        setManagerNotifyEnabled(data.manager_notify_enabled ?? false);
        setManagerNumbers(data.manager_numbers || []);
        setManagerAcceptMessage(data.manager_accept_message || '');
        setManagerRejectMessage(data.manager_reject_message || '');
        setManagerDelaySeconds((data as any).manager_delay_seconds ?? 5);
      }
    }
    fetchStatusNotifConfig();
  }, []);

  // Fetch webhooks
  useEffect(() => {
    async function fetchWebhooks() {
      const { data } = await supabase
        .from('proposal_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setWebhooks(data);
    }
    fetchWebhooks();
  }, []);

  // Fetch webhook logs
  useEffect(() => {
    async function fetchLogs() {
      const { data } = await supabase
        .from('proposal_webhook_logs')
        .select('*, proposal_webhooks(nome)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setWebhookLogs(data);
    }
    fetchLogs();
  }, []);

  // Fetch TTS logs
  const fetchTtsLogs = async () => {
    setLoadingTtsLogs(true);
    try {
      const { data, error } = await supabase
        .from('proposal_tts_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setTtsLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching TTS logs:', err);
    } finally {
      setLoadingTtsLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'auto-remarketing') {
      fetchTtsLogs();
    }
  }, [activeTab]);

  // Fetch Baserow config
  useEffect(() => {
    async function fetchBaserowConfig() {
      const { data } = await supabase
        .from('baserow_integrations')
        .select('*')
        .eq('module', 'proposals')
        .maybeSingle();
      if (data) {
        setBaserowEnabled(data.is_enabled ?? false);
        setBaserowApiUrl(data.api_url || '');
        setBaserowToken(data.api_token || '');
        setBaserowTableId(data.table_id || '');
        setBaserowEvents(data.events || []);
      }
    }
    fetchBaserowConfig();
  }, []);

  const handleSaveBaserow = async () => {
    setIsSavingBaserow(true);
    try {
      const { error } = await supabase
        .from('baserow_integrations')
        .update({
          is_enabled: baserowEnabled,
          api_url: baserowApiUrl,
          api_token: baserowToken,
          table_id: baserowTableId,
          events: baserowEvents,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('module', 'proposals');
      if (error) throw error;
      toast.success('Configuração Baserow salva!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setIsSavingBaserow(false);
    }
  };

  const handleSaveStatusNotif = async () => {
    setIsSavingStatusNotif(true);
    try {
      const payload = {
        enabled: statusNotifEnabled,
        accept_enabled: acceptEnabled,
        accept_channel: acceptChannel,
        accept_message_template: acceptMessageTemplate,
        reject_enabled: rejectEnabled,
        reject_channel: rejectChannel,
        reject_message_template: rejectMessageTemplate,
        manager_notify_enabled: managerNotifyEnabled,
        manager_numbers: managerNumbers.filter(n => n.trim()),
        manager_accept_message: managerAcceptMessage,
        manager_reject_message: managerRejectMessage,
        manager_delay_seconds: managerDelaySeconds,
        updated_at: new Date().toISOString(),
      };

      if (statusNotifId) {
        const { error } = await supabase
          .from('proposal_status_notifications')
          .update(payload)
          .eq('id', statusNotifId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('proposal_status_notifications')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setStatusNotifId(data.id);
      }
      toast.success('Configurações de confirmação salvas!');
    } catch (err: any) {
      console.error('Error saving status notif config:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSavingStatusNotif(false);
    }
  };

  const handleAddManagerNumber = () => {
    if (newManagerNumber.trim()) {
      setManagerNumbers(prev => [...prev, newManagerNumber.trim()]);
      setNewManagerNumber('');
    }
  };

  const handleRemoveManagerNumber = (index: number) => {
    setManagerNumbers(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddWebhook = async () => {
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) {
      toast.error('Preencha nome e URL do webhook');
      return;
    }
    const { data, error } = await supabase.from('proposal_webhooks').insert({
      nome: newWebhookName,
      url: newWebhookUrl,
      secret_key: newWebhookSecret || null,
      eventos: newWebhookEvents,
    }).select().single();

    if (error) {
      toast.error('Erro ao criar webhook');
      return;
    }
    setWebhooks(prev => [data, ...prev]);
    setNewWebhookName('');
    setNewWebhookUrl('');
    setNewWebhookSecret('');
    toast.success('Webhook criado!');
  };

  const handleToggleWebhook = async (id: string, active: boolean) => {
    await supabase.from('proposal_webhooks').update({ is_active: active }).eq('id', id);
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: active } : w));
  };

  const handleDeleteWebhook = async (id: string) => {
    await supabase.from('proposal_webhooks').delete().eq('id', id);
    setWebhooks(prev => prev.filter(w => w.id !== id));
    toast.success('Webhook removido');
  };

  const handleSave = async () => {
    await updateConfig.mutateAsync({
      gmail_user: gmailUser || null,
      gmail_app_password: gmailAppPassword || null,
      gmail_sender_name: gmailSenderName || null,
      evolution_api_url: evolutionApiUrl || null,
      evolution_api_key: evolutionApiKey || null,
      evolution_instance_name: evolutionInstanceName || null,
      email_enabled: emailEnabled,
      whatsapp_enabled: whatsappEnabled,
      auto_remarketing_enabled: autoRemarketingEnabled,
      auto_remarketing_max_days: autoRemarketingMaxDays,
      auto_remarketing_channel: autoRemarketingChannel,
      auto_remarketing_cron_hour: autoRemarketingCronHour,
      ghost_mode_enabled: ghostModeEnabled,
      ghost_mode_type: ghostModeType,
      ghost_view_threshold: ghostViewThreshold,
      ghost_mode_day: ghostModeDay,
      ghost_audio_url: ghostAudioUrl || null,
      ghost_video_url: ghostVideoUrl || null,
      elevenlabs_api_key: elevenlabsApiKey || null,
      elevenlabs_voice_id: elevenlabsVoiceId || null,
      tts_text: ttsText || null,
    } as any);

    // Update cron schedule
    try {
      const { error } = await supabase.functions.invoke('update-remarketing-cron', {
        body: { cron_hour_brt: autoRemarketingCronHour },
      });
      if (error) console.error('Error updating cron:', error);
    } catch (err) {
      console.error('Error updating cron schedule:', err);
    }
  };

  const callElevenLabsFunction = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente e tente de novo.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposals-elevenlabs-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Falha ao chamar ElevenLabs (${response.status})`);
    }
    return data;
  };

  const callGhostTestSendFunction = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente e tente de novo.');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposals-ghost-test-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Falha no teste de envio (${response.status})`);
    }
    return data;
  };

  const cronHourUTC = ((autoRemarketingCronHour + 3) % 24);
  const cronDisplayBRT = `${String(autoRemarketingCronHour).padStart(2, '0')}:00`;
  const selectedVoice = voicesList.find((voice) => voice.voice_id === elevenlabsVoiceId);
  const isFreeVoice = (voice: { category?: string; voice_type?: string }) => {
    const c = String(voice.category || '').toLowerCase();
    const t = String(voice.voice_type || '').toLowerCase();
    return t === 'default' || c === 'premade' || c === 'generated';
  };
  const filteredVoices = voicesList.filter((voice) => {
    if (onlyFreeVoices && !isFreeVoice(voice)) return false;
    const query = voiceSearch.trim().toLowerCase();
    if (!query) return true;
    return [voice.name, voice.voice_id, voice.category, voice.voice_type, voice.labels?.gender, voice.labels?.accent, voice.labels?.language]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  // Auto-sync voices once when API key is configured
  useEffect(() => {
    if (voicesAutoSynced || voicesList.length > 0 || !elevenlabsApiKey.trim() || loadingVoices) return;
    setVoicesAutoSynced(true);
    setLoadingVoices(true);
    callElevenLabsFunction({ action: 'list_voices', apiKey: elevenlabsApiKey, voiceType: 'all' })
      .then((data) => setVoicesList(data.voices || []))
      .catch(() => { /* silent */ })
      .finally(() => setLoadingVoices(false));
  }, [elevenlabsApiKey, voicesAutoSynced, voicesList.length, loadingVoices]);


  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/propostas')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Configurações de Propostas</h1>
              <p className="text-muted-foreground">
                Configure identidade visual, envio por Email e WhatsApp
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar + Content layout */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar nav */}
          <nav className="md:w-56 shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    onClick={() => setActiveTab(item.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap w-full text-left",
                      activeTab === item.value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'branding' && <BrandingConfig />}

            {activeTab === 'email' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Configuração Gmail</CardTitle>
                      <CardDescription>Configure as credenciais do Gmail para envio de propostas</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="email-enabled">Habilitado</Label>
                      <Switch id="email-enabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email do Gmail</Label>
                      <Input type="email" placeholder="seu@gmail.com" value={gmailUser} onChange={(e) => setGmailUser(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha de App</Label>
                      <div className="relative">
                        <Input type={showGmailPassword ? 'text' : 'password'} placeholder="Senha de app do Google" value={gmailAppPassword} onChange={(e) => setGmailAppPassword(e.target.value)} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowGmailPassword(!showGmailPassword)}>
                          {showGmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Use uma senha de app, não a senha normal do Gmail</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Remetente</Label>
                    <Input placeholder="Nome da Empresa" value={gmailSenderName} onChange={(e) => setGmailSenderName(e.target.value)} />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={updateConfig.isPending}>
                      {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'whatsapp' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Configuração Evolution API</CardTitle>
                      <CardDescription>Configure a API Evolution para envio via WhatsApp</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="whatsapp-enabled">Habilitado</Label>
                      <Switch id="whatsapp-enabled" checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL da API</Label>
                    <Input placeholder="https://api.evolution.com" value={evolutionApiUrl} onChange={(e) => setEvolutionApiUrl(e.target.value)} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <div className="relative">
                        <Input type={showApiKey ? 'text' : 'password'} placeholder="Sua API Key" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowApiKey(!showApiKey)}>
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome da Instância</Label>
                      <Input placeholder="instancia01" value={evolutionInstanceName} onChange={(e) => setEvolutionInstanceName(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={updateConfig.isPending}>
                      {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar WhatsApp
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'auto-remarketing' && (
              <Card>
                <CardHeader className="pb-3 border-b mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <RefreshCcw className="h-5 w-5 text-orange-500" />
                        Remarketing & Modo Ghost
                      </CardTitle>
                      <CardDescription>Follow-ups automáticos e mensagens de voz/vídeo personalizadas</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="auto-remarketing-enabled">Ativado</Label>
                      <Switch id="auto-remarketing-enabled" checked={autoRemarketingEnabled} onCheckedChange={setAutoRemarketingEnabled} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  <Tabs defaultValue="geral" className="w-full">
                    <TabsList className="flex flex-wrap h-auto w-full gap-1 bg-muted p-1 mb-8">
                      <TabsTrigger value="geral" className="flex-1 min-w-[120px] gap-2"><Clock className="h-4 w-4" /> Geral</TabsTrigger>
                      {canViewVoices && <TabsTrigger value="vozes" className="flex-1 min-w-[120px] gap-2"><Mic className="h-4 w-4" /> Vozes IA</TabsTrigger>}
                      {canViewGhost && <TabsTrigger value="ghost" className="flex-1 min-w-[120px] gap-2">👻 Modo Ghost</TabsTrigger>}
                      <TabsTrigger value="logs" className="flex-1 min-w-[120px] gap-2"><Database className="h-4 w-4" /> Logs</TabsTrigger>
                    </TabsList>


                    <TabsContent value="geral" className="space-y-6 animate-in fade-in-50 duration-300">
                      <div className="flex items-start gap-3 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200/50">
                        <Info className="h-5 w-5 mt-0.5 shrink-0 text-blue-500" />
                        <div>
                          <p className="font-semibold">Como funciona o Remarketing?</p>
                          <p className="mt-1 text-muted-foreground leading-relaxed">
                            O sistema envia automaticamente um follow-up por dia para propostas
                            "Visualizadas". O envio para quando o cliente assina, recusa ou atinge o limite de dias.
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="space-y-3 p-4 border rounded-lg bg-background/50">
                          <Label className="flex items-center gap-2 font-semibold">
                            <Clock className="h-4 w-4 text-primary" />
                            Horário do envio
                          </Label>
                          <Select value={String(autoRemarketingCronHour)} onValueChange={(v) => setAutoRemarketingCronHour(Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            Todos os dias às {cronDisplayBRT} (Brasília)
                          </p>
                        </div>

                        <div className="space-y-3 p-4 border rounded-lg bg-background/50">
                          <Label className="font-semibold">Quantidade de dias</Label>
                          <Select value={String(autoRemarketingMaxDays)} onValueChange={(v) => setAutoRemarketingMaxDays(Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 5, 7, 10, 14].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'dia' : 'dias'}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">Duração da sequência de follow-ups</p>
                        </div>

                        <div className="space-y-3 p-4 border rounded-lg bg-background/50">
                          <Label className="font-semibold">Canal de envio</Label>
                          <Select value={autoRemarketingChannel} onValueChange={setAutoRemarketingChannel}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="both">Ambos (Email + WhatsApp)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">Escolha por onde o cliente receberá</p>
                        </div>
                      </div>

                      <div className="bg-muted/30 border border-border rounded-lg p-5 space-y-3">
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <RefreshCcw className="h-4 w-4" /> Fluxo de Exemplo:
                        </p>
                        <div className="text-sm space-y-2 text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="w-20 font-mono text-[10px] bg-muted px-2 py-0.5 rounded text-center">DIA 0</span>
                            <span>Proposta enviada manualmente</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="w-20 font-mono text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded text-center">VISUALIZADA</span>
                            <span>Cliente abre o link da proposta</span>
                          </div>
                          <div className="flex items-center gap-3 italic text-[11px] opacity-70">
                            <span className="w-20 text-center">...</span>
                            <span>Seguindo as regras de dias configuradas acima:</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="w-20 font-mono text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded text-center">FINAL</span>
                            <span>Remarketing para ao assinar ou atingir limite</span>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {canViewVoices && <TabsContent value="vozes" className="space-y-6 animate-in fade-in-50 duration-300">
                      <ElevenLabsCreditsCard
                        data={elevenPropostas}
                        loading={elevenLabsMulti.loading}
                        error={elevenLabsMulti.error}
                        onRefresh={elevenLabsMulti.refresh}
                        moduleLabel="Propostas"
                      />
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="p-4 border rounded-lg bg-background/50 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-t-lg -mx-4 -mt-4 border-b">
                              <div className="flex items-center gap-2 min-w-0">
                                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <Label className="font-bold truncate text-sm">Configurar ElevenLabs</Label>
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 w-full sm:w-auto shrink-0 shadow-sm border"
                                disabled={loadingVoices || !elevenlabsApiKey.trim()}
                                onClick={async () => {
                                  setLoadingVoices(true);
                                  try {
                                    const data = await callElevenLabsFunction({ action: 'list_voices', apiKey: elevenlabsApiKey, voiceType: 'all' });
                                    const list = data.voices || [];
                                    setVoicesList(list);
                                    toast.success(`${list.length} vozes carregadas`);
                                  } catch (err: any) {
                                    toast.error('Erro ao listar vozes: ' + err.message);
                                  } finally {
                                    setLoadingVoices(false);
                                  }
                                }}
                              >
                                {loadingVoices ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <RefreshCcw className="h-3 w-3 mr-2" />}
                                Sincronizar
                              </Button>
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-xs">Chave da API</Label>
                              <div className="relative">
                                <Input
                                  type={showElevenKey ? 'text' : 'password'}
                                  value={elevenlabsApiKey}
                                  onChange={(e) => { setElevenlabsApiKey(e.target.value); setTtsPreviewUrl(null); }}
                                  placeholder="sk_..."
                                  className="pr-10"
                                />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowElevenKey(!showElevenKey)}>
                                  {showElevenKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            {selectedVoice ? (
                              <div className="p-3 border-2 border-primary/30 bg-primary/5 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/15 flex items-center justify-center">
                                    <Mic className="h-5 w-5 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm truncate">{selectedVoice.name}</p>
                                      <Badge variant="outline" className={cn('text-[9px] shrink-0', getVoicePlanInfo(selectedVoice).className)}>
                                        {getVoicePlanInfo(selectedVoice).label}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate">{selectedVoice.voice_id}</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 border-2 border-dashed border-amber-500/40 bg-amber-500/5 rounded-lg text-center">
                                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">⚠️ Selecione uma voz na lista ao lado para continuar</p>
                              </div>
                            )}

                            <div className="space-y-2 pt-2 border-t mt-4">
                              <Label className="font-semibold flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-purple-500" /> Texto do Áudio Dinâmico
                              </Label>
                              <Textarea
                                value={ttsText}
                                onChange={(e) => setTtsText(e.target.value)}
                                placeholder="Ex: Oi {{nome_cliente}}, vi que você olhou a proposta..."
                                rows={4}
                                className="resize-none"
                              />
                              <p className="text-[10px] text-blue-500 font-medium">Use {"{{nome_cliente}}"} para falar o nome do cliente no áudio dinâmico.</p>

                              {/* Variável de teste sincronizada com o Laboratório */}
                              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Variável {"{{nome_cliente}}"}</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder="Ex: João Silva"
                                    value={testClientName}
                                    onChange={(e) => setTestClientName(e.target.value)}
                                    className="h-8 text-xs bg-background"
                                  />
                                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" title="Sincronizado com Laboratório" />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-2 pt-1 w-full">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full h-10 min-w-0"
                                    variant="secondary"
                                    disabled={ttsGenerating || !ttsText.trim() || !elevenlabsApiKey.trim() || !elevenlabsVoiceId || !selectedVoice}
                                    onClick={async () => {
                                      if (!testClientName.trim()) {
                                        toast.error('Digite um nome para testar a variável {{nome_cliente}}');
                                        return;
                                      }
                                      setTtsGenerating(true);
                                        try {
                                          const data = await callElevenLabsFunction({ 
                                            text: ttsText.replace(/\{\{\s*nome_cliente\s*\}\}/gi, testClientName), 
                                            voiceId: elevenlabsVoiceId, 
                                            save: false, 
                                            apiKey: elevenlabsApiKey 
                                          });
                                          setTtsPreviewUrl(`data:audio/mpeg;base64,${data.audioContent}`);
                                          toast.success('Prévia gerada!');
                                        } catch (err: any) {
                                        toast.error('Erro: ' + err.message);
                                      } finally {
                                        setTtsGenerating(false);
                                      }
                                    }}
                                  >
                                    {ttsGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mic className="h-4 w-4 mr-2" />}
                                    Gerar Prévia
                                  </Button>
                                  {ttsPreviewUrl && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="default"
                                      className="flex-1 h-10 whitespace-nowrap bg-primary hover:bg-primary/90"
                                      disabled={ttsSaving || !elevenlabsVoiceId || !selectedVoice}
                                      onClick={async () => {
                                        setTtsSaving(true);
                                        try {
                                          const data = await callElevenLabsFunction({ 
                                            text: ttsText.replace(/\{\{\s*nome_cliente\s*\}\}/gi, testClientName || 'Cliente'), 
                                            voiceId: elevenlabsVoiceId, 
                                            save: true, 
                                            apiKey: elevenlabsApiKey 
                                          });
                                          setGhostAudioUrl(data.url);
                                          toast.success('Áudio salvo no Modo Ghost!');
                                        } catch (err: any) {
                                          toast.error('Erro: ' + err.message);
                                        } finally {
                                          setTtsSaving(false);
                                        }
                                      }}
                                    >
                                      Usar no Ghost
                                    </Button>
                                  )}
                                </div>

                              {ttsPreviewUrl && <audio controls src={ttsPreviewUrl} className="h-8 w-full mt-2" />}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="p-4 border rounded-lg bg-background/50 flex flex-col h-full max-h-[500px]">
                            <Label className="font-semibold mb-3 flex items-center gap-2">
                              <Search className="h-4 w-4" /> Buscar Vozes
                            </Label>
                            <Input
                              value={voiceSearch}
                              onChange={(e) => setVoiceSearch(e.target.value)}
                              placeholder="Nome, idioma ou tipo..."
                              className="mb-2"
                            />
                            <label className="flex items-start gap-2 mb-3 text-[11px] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={onlyFreeVoices}
                                onChange={(e) => setOnlyFreeVoices(e.target.checked)}
                                className="h-3 w-3 mt-0.5 accent-primary"
                              />
                              <span className="text-muted-foreground">Mostrar apenas vozes <strong className="text-primary">gratuitas / padrão</strong> (evita erro de plano pago)</span>
                            </label>

                             <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                               {onlyFreeVoices && voicesList.some(v => !isFreeVoice(v)) && (
                                 <div className="text-[9px] bg-muted p-1.5 rounded border border-dashed text-center text-muted-foreground mb-2">
                                   Existem {voicesList.filter(v => !isFreeVoice(v)).length} vozes pagas ocultas pelo filtro.
                                 </div>
                               )}
                               {voicesList.length === 0 ? (
                                 <div className="text-center py-12 text-muted-foreground space-y-2">
                                   <Mic className="h-8 w-8 mx-auto opacity-20" />
                                   <p className="text-xs">Sincronize as vozes para começar</p>
                                 </div>
                               ) : filteredVoices.length === 0 ? (
                                <p className="text-center py-8 text-xs text-muted-foreground">Nenhuma voz encontrada</p>
                              ) : (
                                filteredVoices.map((voice) => (
                                  <button
                                    key={voice.voice_id}
                                    onClick={() => setElevenlabsVoiceId(voice.voice_id)}
                                    className={cn(
                                      "w-full text-left p-3 rounded-md border transition-all hover:shadow-sm",
                                      voice.voice_id === elevenlabsVoiceId 
                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                                        : "border-border bg-transparent hover:bg-muted/50"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="font-bold text-sm truncate">{voice.name}</p>
                                          {voice.voice_id === elevenlabsVoiceId && <Badge className="h-4 text-[8px] uppercase bg-primary hover:bg-primary">Atual</Badge>}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          <Badge variant="secondary" className="text-[7px] h-3 px-1 bg-muted/50 border-none uppercase font-bold">{voice.category || 'N/A'}</Badge>
                                          {voice.labels?.language && <Badge variant="outline" className="text-[8px] h-3 px-1">{voice.labels.language}</Badge>}
                                          {voice.labels?.gender && <span className="text-[9px] text-muted-foreground">{voice.labels.gender}</span>}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className={cn('text-[8px] px-1 whitespace-nowrap', getVoicePlanInfo(voice).className)}>
                                        {getVoicePlanInfo(voice).label}
                                      </Badge>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>}

                    {canViewGhost && <TabsContent value="ghost" className="space-y-6 animate-in fade-in-50 duration-300">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="p-5 border-2 border-purple-500/30 bg-purple-500/5 rounded-xl space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-xl shrink-0">
                                  👻
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-purple-700 dark:text-purple-400 truncate">Status do Modo Ghost</h3>
                                  <p className="text-xs text-muted-foreground truncate">Envio de áudio/vídeo surpresa</p>
                                </div>
                              </div>
                              <Switch checked={ghostModeEnabled} onCheckedChange={setGhostModeEnabled} className="data-[state=checked]:bg-purple-600 shrink-0" />
                            </div>

                            <div className="space-y-3 border-t border-purple-200/50 pt-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gatilho por Dia</Label>
                                <Select value={String(ghostModeDay)} onValueChange={(v) => setGhostModeDay(Number(v))}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: autoRemarketingMaxDays }, (_, i) => (
                                      <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gatilho por Visualização</Label>
                                <Input type="number" min={0} value={ghostViewThreshold} onChange={(e) => setGhostViewThreshold(Number(e.target.value))} className="h-10" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Formato do Ghost</Label>
                                <Select value={ghostModeType} onValueChange={(v: any) => setGhostModeType(v)}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixed">Fixo (Upload ou IA Salva)</SelectItem>
                                    <SelectItem value="dynamic">Dinâmico (IA gera na hora)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 mt-2">
                                  <p className="text-[10px] leading-relaxed text-yellow-700 dark:text-yellow-400 flex gap-2">
                                    <span className="shrink-0">💡</span>
                                    <span>
                                      {ghostModeType === 'dynamic' 
                                        ? "Modo Dinâmico: A IA gera um novo áudio personalizado com o nome de cada cliente no momento do envio. Consome créditos da ElevenLabs por cada envio."
                                        : "Modo Fixo: Envia o mesmo arquivo de áudio ou vídeo para todos os clientes. Economiza créditos e é ideal para recados gerais."
                                      }
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-5 border rounded-xl bg-background/50 space-y-4">
                            <h3 className="font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Mídias do Ghost</h3>
                            
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Áudio Fixo (.mp3, .ogg)</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="file"
                                    accept="audio/*"
                                    className="h-9 text-xs"
                                    disabled={uploadingGhost === 'audio'}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setUploadingGhost('audio');
                                      try {
                                        const ext = file.name.split('.').pop() || 'mp3';
                                        const path = `ghost/audio-${Date.now()}.${ext}`;
                                        const { error: upErr } = await supabase.storage.from('proposal-images').upload(path, file, { upsert: true, contentType: file.type });
                                        if (upErr) throw upErr;
                                        const { data } = supabase.storage.from('proposal-images').getPublicUrl(path);
                                        setGhostAudioUrl(data.publicUrl);
                                        toast.success('Áudio enviado!');
                                      } catch (err: any) {
                                        toast.error('Erro: ' + err.message);
                                      } finally {
                                        setUploadingGhost(null);
                                      }
                                    }}
                                  />
                                  {uploadingGhost === 'audio' && <Loader2 className="h-4 w-4 animate-spin self-center" />}
                                </div>
                                {ghostAudioUrl && (
                                  <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
                                    <audio controls src={ghostAudioUrl} className="h-7 flex-1" />
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGhostAudioUrl('')}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2 border-t pt-4">
                                <Label className="text-xs">Vídeo (.mp4)</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="file"
                                    accept="video/mp4"
                                    className="h-9 text-xs"
                                    disabled={uploadingGhost === 'video'}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      if (file.size > 16 * 1024 * 1024) { toast.error('Máximo 16MB'); return; }
                                      setUploadingGhost('video');
                                      try {
                                        const path = `ghost/video-${Date.now()}.mp4`;
                                        const { error: upErr } = await supabase.storage.from('proposal-images').upload(path, file, { upsert: true, contentType: file.type });
                                        if (upErr) throw upErr;
                                        const { data } = supabase.storage.from('proposal-images').getPublicUrl(path);
                                        setGhostVideoUrl(data.publicUrl);
                                        toast.success('Vídeo enviado!');
                                      } catch (err: any) {
                                        toast.error('Erro: ' + err.message);
                                      } finally {
                                        setUploadingGhost(null);
                                      }
                                    }}
                                  />
                                  {uploadingGhost === 'video' && <Loader2 className="h-4 w-4 animate-spin self-center" />}
                                </div>
                                {ghostVideoUrl && (
                                  <div className="flex flex-col gap-2 bg-muted p-2 rounded-lg">
                                    <video src={ghostVideoUrl} className="h-32 rounded w-full object-cover" controls />
                                    <Button variant="destructive" size="sm" className="h-7 w-full" onClick={() => setGhostVideoUrl('')}><Trash2 className="h-3 w-3 mr-1" /> Remover Vídeo</Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 flex flex-col">
                          <div className="p-5 border-2 border-primary/30 bg-primary/5 rounded-xl space-y-4 flex-1">
                            <h3 className="font-bold flex items-center gap-2"><RefreshCcw className="h-4 w-4" /> Laboratório de Testes</h3>
                            <p className="text-xs text-muted-foreground">Simule o envio exatamente como o cliente receberá.</p>
                            
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Número de Destino</Label>
                                <Input placeholder="5544999999999" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome para Variável {"{{nome_cliente}}"}</Label>
                                <Input placeholder="Ex: João Silva" value={testClientName} onChange={(e) => setTestClientName(e.target.value)} />
                              </div>

                              <div className="flex flex-col gap-3 pt-2">
                                <Button
                                  variant="outline"
                                  className="h-16 border-primary/30 hover:bg-primary/5 hover:border-primary flex items-center justify-start px-4 gap-4 transition-all group overflow-hidden relative"
                                  disabled={!!testSending || !testPhone.trim() || (ghostModeType === 'fixed' ? !ghostAudioUrl : !ttsText.trim())}
                                  onClick={async () => {
                                    setTestSending('audio');
                                    try {
                                      await handleSave();
                                      const data = await callGhostTestSendFunction({ 
                                        phone: testPhone, 
                                        mediaType: 'audio', 
                                        clientName: testClientName || 'Cliente', 
                                        mediaUrl: ghostModeType === 'fixed' ? ghostAudioUrl : undefined 
                                      });
                                      toast.success(`Áudio enviado com sucesso!`);
                                    } catch (err: any) {
                                      toast.error('Falha no envio: ' + err.message);
                                    } finally {
                                      setTestSending(null);
                                    }
                                  }}
                                >
                                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                    {testSending === 'audio' ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Mic className="h-5 w-5 text-primary" />}
                                  </div>
                                  <div className="text-left min-w-0 flex-1">
                                    <p className="font-bold text-sm text-foreground">Testar Áudio</p>
                                    <p className="text-[10px] text-muted-foreground truncate">Envia o áudio configurado via WhatsApp</p>
                                  </div>
                                  <div className="absolute right-0 top-0 h-full w-1 bg-primary/0 group-hover:bg-primary transition-all" />
                                </Button>

                                <Button
                                  variant="outline"
                                  className="h-16 border-primary/30 hover:bg-primary/5 hover:border-primary flex items-center justify-start px-4 gap-4 transition-all group overflow-hidden relative"
                                  disabled={!!testSending || !testPhone.trim() || !ghostVideoUrl}
                                  onClick={async () => {
                                    setTestSending('video');
                                    try {
                                      await handleSave();
                                      const data = await callGhostTestSendFunction({ 
                                        phone: testPhone, 
                                        mediaType: 'video', 
                                        clientName: testClientName, 
                                        mediaUrl: ghostVideoUrl 
                                      });
                                      toast.success(`Vídeo enviado com sucesso!`);
                                    } catch (err: any) {
                                      toast.error('Falha no envio: ' + err.message);
                                    } finally {
                                      setTestSending(null);
                                    }
                                  }}
                                >
                                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                    {testSending === 'video' ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Eye className="h-5 w-5 text-primary" />}
                                  </div>
                                  <div className="text-left min-w-0 flex-1">
                                    <p className="font-bold text-sm text-foreground">Testar Vídeo</p>
                                    <p className="text-[10px] text-muted-foreground truncate">Envia o vídeo configurado via WhatsApp</p>
                                  </div>
                                  <div className="absolute right-0 top-0 h-full w-1 bg-primary/0 group-hover:bg-primary transition-all" />
                                </Button>
                              </div>
                            </div>
                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                              <p className="text-[10px] text-yellow-700 dark:text-yellow-400 leading-relaxed italic">
                                💡 Dica: Se usar Áudio Dinâmico, o sistema gerará uma fala exclusiva para o nome <strong>"{testClientName}"</strong> durante este teste.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>}

                    <TabsContent value="logs" className="animate-in fade-in-50 duration-300">
                      <div className="border rounded-xl bg-slate-950 p-5 overflow-hidden shadow-inner">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-slate-800 flex items-center justify-center">
                              <Database className="h-4 w-4 text-blue-400" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-200">Histórico de Requisições IA</h4>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-300" onClick={fetchTtsLogs}>
                            <RefreshCcw className="h-3 w-3 mr-1" /> Atualizar
                          </Button>
                        </div>
                        
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar font-mono text-[11px]">
                          {loadingTtsLogs ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
                          ) : ttsLogs.length === 0 ? (
                            <p className="text-center py-12 text-slate-600 italic">Nenhum log disponível no momento.</p>
                          ) : (
                            ttsLogs.map((log) => (
                              <div key={log.id} className="p-3 rounded border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors text-[10px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className={cn(
                                    "text-[9px] h-4",
                                    log.status === 'success' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"
                                  )}>
                                    {log.status.toUpperCase()}
                                  </Badge>
                                  <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                                  {log.response_time_ms && <span className="text-blue-500 ml-auto">{log.response_time_ms}ms</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-slate-400 mb-2">
                                  <div className="truncate">Ação: <span className="text-slate-200">{log.action}</span></div>
                                  <div className="truncate">Voz: <span className="text-slate-200">{log.voice_id || 'N/A'}</span></div>
                                </div>
                                {log.text_preview && (
                                  <div className="bg-slate-950 p-2 rounded mb-2 text-slate-300 italic opacity-80 truncate">
                                    "{log.text_preview}..."
                                  </div>
                                )}
                                {log.error_details && (
                                  <div className="bg-red-950/20 p-2 rounded border border-red-900/30 text-red-300 whitespace-pre-wrap overflow-x-auto">
                                    {typeof log.error_details === 'string' ? log.error_details : JSON.stringify(log.error_details, null, 2)}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end pt-6 border-t mt-6">
                    <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg" className="px-8 shadow-md">
                      {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Todas as Configurações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'confirmacoes' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        Notificações de Status
                      </CardTitle>
                      <CardDescription>Envie mensagens automáticas quando o cliente aceitar ou recusar uma proposta</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="status-notif-enabled">Ativado</Label>
                      <Switch id="status-notif-enabled" checked={statusNotifEnabled} onCheckedChange={setStatusNotifEnabled} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Como funciona?</p>
                      <p className="mt-1 text-muted-foreground">
                        Quando o cliente aceita ou recusa uma proposta, o sistema envia automaticamente uma mensagem personalizada
                        via WhatsApp ou Email. Use as variáveis <code className="bg-muted px-1 rounded">{'{nome}'}</code>, <code className="bg-muted px-1 rounded">{'{titulo}'}</code> e <code className="bg-muted px-1 rounded">{'{motivo}'}</code> nos templates.
                      </p>
                    </div>
                  </div>

                  {/* Proposta Aceita */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">✅ Proposta Aceita</h4>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="accept-enabled" className="text-sm">Ativado</Label>
                        <Switch id="accept-enabled" checked={acceptEnabled} onCheckedChange={setAcceptEnabled} />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Canal de envio</Label>
                        <Select value={acceptChannel} onValueChange={setAcceptChannel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="both">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem</Label>
                      <Textarea rows={4} value={acceptMessageTemplate} onChange={(e) => setAcceptMessageTemplate(e.target.value)}
                        placeholder='Olá {nome}! 🎉 Sua proposta "{titulo}" foi aceita com sucesso! O próximo passo é formalizar o contrato.' />
                    </div>
                  </div>

                  {/* Proposta Recusada */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">❌ Proposta Recusada</h4>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="reject-enabled" className="text-sm">Ativado</Label>
                        <Switch id="reject-enabled" checked={rejectEnabled} onCheckedChange={setRejectEnabled} />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Canal de envio</Label>
                        <Select value={rejectChannel} onValueChange={setRejectChannel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="both">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem</Label>
                      <Textarea rows={4} value={rejectMessageTemplate} onChange={(e) => setRejectMessageTemplate(e.target.value)}
                        placeholder='Olá {nome}, vi que a proposta "{titulo}" foi recusada. Posso ajudar com alguma dúvida?' />
                    </div>
                  </div>

                  {/* Manager Notifications */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        📱 Notificar Gestores/Coordenadores
                      </h4>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="manager-notify" className="text-sm">Ativado</Label>
                        <Switch id="manager-notify" checked={managerNotifyEnabled} onCheckedChange={setManagerNotifyEnabled} />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Envie uma notificação via WhatsApp para gerentes e coordenadores quando uma proposta for aceita ou recusada.
                    </p>

                    <div className="space-y-3">
                      <Label>Números dos gestores</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="5511999999999"
                          value={newManagerNumber}
                          onChange={(e) => setNewManagerNumber(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddManagerNumber()}
                        />
                        <Button variant="outline" size="icon" onClick={handleAddManagerNumber}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {managerNumbers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {managerNumbers.map((num, idx) => (
                            <Badge key={idx} variant="secondary" className="gap-1">
                              {num}
                              <button onClick={() => handleRemoveManagerNumber(idx)} className="ml-1 hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Delay entre notificações
                      </Label>
                      <Select value={String(managerDelaySeconds)} onValueChange={(v) => setManagerDelaySeconds(Number(v))}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[0, 2, 3, 5, 10, 15, 20, 30].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 0 ? 'Sem delay' : `${n} segundos`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Intervalo entre o envio para cada gestor (evita bloqueio por spam)</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Mensagem (Aceita)</Label>
                        <Textarea rows={3} value={managerAcceptMessage} onChange={(e) => setManagerAcceptMessage(e.target.value)}
                          placeholder='A proposta "{titulo}" foi ACEITA pelo cliente {nome}. Entre em contato imediatamente!' />
                      </div>
                      <div className="space-y-2">
                        <Label>Mensagem (Recusada)</Label>
                        <Textarea rows={3} value={managerRejectMessage} onChange={(e) => setManagerRejectMessage(e.target.value)}
                          placeholder='A proposta "{titulo}" foi RECUSADA pelo cliente {nome}. Motivo: {motivo}. Faça o follow-up!' />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveStatusNotif} disabled={isSavingStatusNotif}>
                    {isSavingStatusNotif ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Confirmações
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeTab === 'webhooks' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5 text-primary" />
                    Webhooks de Propostas
                  </CardTitle>
                  <CardDescription>
                    Configure webhooks para receber notificações em tempo real (ex: n8n) quando propostas forem visualizadas, aceitas ou recusadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Payload enviado</p>
                      <p className="mt-1 text-muted-foreground">
                        Cada webhook recebe: <code className="bg-muted px-1 rounded">evento</code>, <code className="bg-muted px-1 rounded">proposta</code> (id, titulo, status, valor),
                        <code className="bg-muted px-1 rounded"> cliente</code> (nome, telefone, email) e <code className="bg-muted px-1 rounded">motivo_recusa</code> (quando aplicável).
                      </p>
                    </div>
                  </div>

                  {/* Add webhook form */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-semibold">Adicionar Webhook</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input placeholder="n8n Notificações" value={newWebhookName} onChange={(e) => setNewWebhookName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Secret Key (opcional)</Label>
                        <Input placeholder="chave-secreta" value={newWebhookSecret} onChange={(e) => setNewWebhookSecret(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>URL do Webhook</Label>
                      <Input placeholder="https://seu-n8n.com/webhook/..." value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Eventos</Label>
                      <div className="flex flex-wrap gap-2">
                        {['proposta.enviada', 'proposta.visualizada', 'proposta.aceita', 'proposta.recusada'].map(evt => (
                          <Badge
                            key={evt}
                            variant={newWebhookEvents.includes(evt) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => {
                              setNewWebhookEvents(prev =>
                                prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]
                              );
                            }}
                          >
                            {evt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleAddWebhook}>
                      <Plus className="h-4 w-4 mr-2" /> Adicionar Webhook
                    </Button>
                  </div>

                  {/* Webhook list */}
                  {webhooks.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Webhooks Configurados</h4>
                      {webhooks.map(wh => (
                        <div key={wh.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{wh.nome}</span>
                              <Badge variant={wh.is_active ? 'default' : 'secondary'} className="text-xs">
                                {wh.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{wh.url}</p>
                            <div className="flex gap-1 mt-1">
                              {wh.eventos?.map((e: string) => (
                                <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch checked={wh.is_active} onCheckedChange={(v) => handleToggleWebhook(wh.id, v)} />
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteWebhook(wh.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent logs */}
                  {webhookLogs.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Últimos Disparos</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-2">Webhook</th>
                                <th className="text-left p-2">Evento</th>
                                <th className="text-left p-2">Status</th>
                                <th className="text-left p-2">Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {webhookLogs.map(log => (
                                <tr key={log.id} className="border-t">
                                  <td className="p-2">{log.proposal_webhooks?.nome || '—'}</td>
                                  <td className="p-2"><Badge variant="outline" className="text-xs">{log.evento}</Badge></td>
                                  <td className="p-2">
                                    <Badge variant={log.success ? 'default' : 'destructive'} className="text-xs">
                                      {log.success ? `✅ ${log.response_status}` : `❌ ${log.response_status || 'erro'}`}
                                    </Badge>
                                  </td>
                                  <td className="p-2 text-muted-foreground">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'baserow' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Integração Baserow
                      </CardTitle>
                      <CardDescription>
                        Crie leads automaticamente no Baserow quando eventos de proposta ocorrerem
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="baserow-enabled">Ativado</Label>
                      <Switch id="baserow-enabled" checked={baserowEnabled} onCheckedChange={setBaserowEnabled} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Como funciona?</p>
                      <p className="mt-1 text-muted-foreground">
                        Quando um evento selecionado ocorrer, o sistema cria automaticamente 2 linhas no Baserow:
                        uma com o número no formato <code className="bg-muted px-1 rounded">@s.whatsapp.net</code> e outra com <code className="bg-muted px-1 rounded">+número</code>.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>URL da API Baserow</Label>
                      <Input
                        placeholder="https://baserow.seudominio.com"
                        value={baserowApiUrl}
                        onChange={(e) => setBaserowApiUrl(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">URL base da sua instância Baserow (sem barra final)</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Token da API</Label>
                        <div className="relative">
                          <Input
                            type={showBaserowToken ? 'text' : 'password'}
                            placeholder="Token do Baserow"
                            value={baserowToken}
                            onChange={(e) => setBaserowToken(e.target.value)}
                          />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setShowBaserowToken(!showBaserowToken)}>
                            {showBaserowToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>ID da Tabela</Label>
                        <Input
                          placeholder="533"
                          value={baserowTableId}
                          onChange={(e) => setBaserowTableId(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Eventos que criam leads</Label>
                    <p className="text-xs text-muted-foreground mb-2">Selecione quais eventos devem criar leads no Baserow</p>
                    <div className="flex flex-wrap gap-2">
                      {['proposta.enviada', 'proposta.visualizada', 'proposta.aceita', 'proposta.recusada'].map(evt => (
                        <Badge
                          key={evt}
                          variant={baserowEvents.includes(evt) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setBaserowEvents(prev =>
                              prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]
                            );
                          }}
                        >
                          {evt}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleSaveBaserow} disabled={isSavingBaserow}>
                    {isSavingBaserow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Baserow
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
