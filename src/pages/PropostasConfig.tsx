import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Mail, MessageSquare, Save, Loader2, Eye, EyeOff, Palette, RefreshCcw, Info, Bell, Webhook, Plus, Trash2, Clock, Database } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useProposalSendConfig } from '@/hooks/useProposalSending';
import { BrandingConfig } from '@/components/proposals/BrandingConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  const [activeTab, setActiveTab] = useState('branding');

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
    updateConfig.mutate({
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

  const cronHourUTC = ((autoRemarketingCronHour + 3) % 24);
  const cronDisplayBRT = `${String(autoRemarketingCronHour).padStart(2, '0')}:00`;

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
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <RefreshCcw className="h-5 w-5 text-orange-500" />
                        Remarketing Automático
                      </CardTitle>
                      <CardDescription>Envie follow-ups automáticos para clientes que visualizaram mas não assinaram</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="auto-remarketing-enabled">Ativado</Label>
                      <Switch id="auto-remarketing-enabled" checked={autoRemarketingEnabled} onCheckedChange={setAutoRemarketingEnabled} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-2 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Como funciona?</p>
                      <p className="mt-1 text-muted-foreground">
                        Quando ativado, o sistema envia automaticamente uma mensagem de follow-up por dia para propostas
                        com status "Visualizada". O envio para quando o cliente assinar, recusar, ou atingir o limite de dias configurado.
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Horário do envio (BRT)
                      </Label>
                      <Select value={String(autoRemarketingCronHour)} onValueChange={(v) => setAutoRemarketingCronHour(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Todos os dias às {cronDisplayBRT} (Brasília) — {String(cronHourUTC).padStart(2, '0')}:00 UTC
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de dias</Label>
                      <Select value={String(autoRemarketingMaxDays)} onValueChange={(v) => setAutoRemarketingMaxDays(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 5, 7, 10, 14].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'dia' : 'dias'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Quantos dias seguidos enviar remarketing após a visualização</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Canal de envio</Label>
                      <Select value={autoRemarketingChannel} onValueChange={setAutoRemarketingChannel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="both">Ambos (Email + WhatsApp)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">O canal precisa estar configurado nas abas de Email/WhatsApp</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium">Exemplo de fluxo:</p>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p>📤 <strong>Dia 0:</strong> Proposta enviada manualmente</p>
                      <p>👁️ <strong>Cliente visualiza:</strong> Status muda para "Visualizada"</p>
                      {Array.from({ length: Math.min(autoRemarketingMaxDays, 5) }, (_, i) => (
                        <p key={i}>🔄 <strong>Dia {i + 1}:</strong> Remarketing automático enviado às {cronDisplayBRT}</p>
                      ))}
                      {autoRemarketingMaxDays > 5 && <p>🔄 <strong>...</strong> até o dia {autoRemarketingMaxDays}</p>}
                      <p>✅ <strong>Se assinar:</strong> Remarketing para automaticamente</p>
                      <p>❌ <strong>Se recusar:</strong> Remarketing para automaticamente</p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={updateConfig.isPending}>
                      {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Remarketing
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
                      {['proposta.enviada', 'proposta.aceita', 'proposta.recusada'].map(evt => (
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
