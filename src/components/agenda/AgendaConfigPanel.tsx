import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Bell, Calendar, Info, ExternalLink, HelpCircle, RefreshCw, Plus, Trash2, MessageSquare, Mail, History, Database, Eye, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCalendarConfig, useUpdateCalendarConfig } from '@/hooks/useCalendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WhatsAppInstance {
  id: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  is_active: boolean;
  last_used_at: string | null;
}

interface NotificationLog {
  id: string;
  event_id: string | null;
  channel: string;
  recipient_type: string;
  recipient_name: string | null;
  recipient_contact: string | null;
  message_sent: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
}

export function AgendaConfigPanel() {
  const { data: config, isLoading } = useCalendarConfig();
  const updateConfig = useUpdateCalendarConfig();
  const queryClient = useQueryClient();

  // Google Calendar
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [googleRefreshToken, setGoogleRefreshToken] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState('15');

  // Notifications
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyHoursBefore, setNotifyHoursBefore] = useState('1');
  const [notifyChannel, setNotifyChannel] = useState('whatsapp');
  const [notifyTemplate, setNotifyTemplate] = useState('');
  const [notifyCronEnabled, setNotifyCronEnabled] = useState(false);
  const [notifyCronInterval, setNotifyCronInterval] = useState('15');

  // Daily Summary (Consultor Presencial)
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(false);
  const [dailySummaryHour, setDailySummaryHour] = useState('8');
  const [dailySummaryMinute, setDailySummaryMinute] = useState('0');

  // Independent Gmail config
  const [notifyGmailUser, setNotifyGmailUser] = useState('');
  const [notifyGmailPassword, setNotifyGmailPassword] = useState('');

  // WhatsApp instances
  const [newInstanceUrl, setNewInstanceUrl] = useState('');
  const [newInstanceKey, setNewInstanceKey] = useState('');
  const [newInstanceName, setNewInstanceName] = useState('');

  // Baserow integration state
  const [baserowEnabled, setBaserowEnabled] = useState(false);
  const [baserowApiUrl, setBaserowApiUrl] = useState('');
  const [baserowToken, setBaserowToken] = useState('');
  const [baserowTableId, setBaserowTableId] = useState('');
  const [baserowEvents, setBaserowEvents] = useState<string[]>(['agenda.online', 'agenda.presencial']);
  const [showBaserowToken, setShowBaserowToken] = useState(false);
  const [isSavingBaserow, setIsSavingBaserow] = useState(false);

  const { data: whatsappInstances = [], refetch: refetchInstances } = useQuery({
    queryKey: ['calendar-notification-whatsapp-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_notification_whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WhatsAppInstance[];
    },
  });

  const { data: notificationLogs = [] } = useQuery({
    queryKey: ['calendar-notification-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_notification_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as NotificationLog[];
    },
  });

  // Baserow config query
  const { data: baserowConfig } = useQuery({
    queryKey: ['baserow-config-agenda'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baserow_integrations')
        .select('*')
        .eq('module', 'agenda')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setGoogleEnabled(config.google_calendar_enabled === 'true');
      setGoogleClientId(config.google_client_id || '');
      setGoogleClientSecret(config.google_client_secret || '');
      setGoogleCalendarId(config.google_calendar_id || '');
      setGoogleRefreshToken(config.google_refresh_token || '');
      setAutoSyncEnabled(config.auto_sync_enabled === 'true');
      setSyncInterval(config.sync_interval_minutes || '15');
      setNotifyEnabled(config.notify_client_enabled === 'true');
      setNotifyHoursBefore(config.notify_hours_before || '1');
      setNotifyChannel(config.notify_channel || 'whatsapp');
      setNotifyTemplate(config.notify_message_template || '');
      setNotifyCronEnabled(config.notify_cron_enabled === 'true');
      setNotifyCronInterval(config.notify_cron_interval || '15');
      setNotifyGmailUser(config.notify_gmail_user || '');
      setNotifyGmailPassword(config.notify_gmail_password || '');
      setDailySummaryEnabled(config.daily_summary_enabled === 'true');
      setDailySummaryHour(config.daily_summary_hour_brasilia || '8');
      setDailySummaryMinute(config.daily_summary_minute || '0');
    }
  }, [config]);

  useEffect(() => {
    if (baserowConfig) {
      setBaserowEnabled(baserowConfig.is_enabled ?? false);
      setBaserowApiUrl(baserowConfig.api_url || '');
      setBaserowToken(baserowConfig.api_token || '');
      setBaserowTableId(baserowConfig.table_id || '');
      setBaserowEvents(baserowConfig.events || ['agenda.online', 'agenda.presencial']);
    }
  }, [baserowConfig]);

  const handleSave = async () => {
    const newAutoSync = autoSyncEnabled && googleEnabled;
    const prevAutoSync = config?.auto_sync_enabled === 'true';

    await updateConfig.mutateAsync({
      google_calendar_enabled: googleEnabled ? 'true' : 'false',
      google_client_id: googleClientId,
      google_client_secret: googleClientSecret,
      google_calendar_id: googleCalendarId,
      google_refresh_token: googleRefreshToken,
      auto_sync_enabled: newAutoSync ? 'true' : 'false',
      sync_interval_minutes: syncInterval,
      notify_client_enabled: notifyEnabled ? 'true' : 'false',
      notify_hours_before: notifyHoursBefore,
      notify_channel: notifyChannel,
      notify_message_template: notifyTemplate,
      notify_cron_enabled: notifyCronEnabled ? 'true' : 'false',
      notify_cron_interval: notifyCronInterval,
      notify_gmail_user: notifyGmailUser,
      notify_gmail_password: notifyGmailPassword,
      daily_summary_enabled: dailySummaryEnabled ? 'true' : 'false',
      daily_summary_hour_brasilia: dailySummaryHour,
      daily_summary_minute: dailySummaryMinute,
    });

    // Manage sync cron
    try {
      if (newAutoSync) {
        await supabase.rpc('update_calendar_sync_cron', { p_interval_minutes: parseInt(syncInterval) });
      } else if (prevAutoSync && !newAutoSync) {
        await supabase.rpc('disable_calendar_sync_cron');
      }
    } catch (e) {
      console.error('Sync cron update error:', e);
    }

    // Manage notify cron
    try {
      if (notifyCronEnabled && notifyEnabled) {
        await supabase.rpc('update_calendar_notify_cron', { p_interval_minutes: parseInt(notifyCronInterval) });
      } else {
        await supabase.rpc('disable_calendar_notify_cron');
      }
    } catch (e) {
      console.error('Notify cron update error:', e);
    }

    // Manage daily physical summary cron
    try {
      if (dailySummaryEnabled) {
        await (supabase.rpc as any)('update_calendar_physical_summary_cron', {
          p_hour_brasilia: parseInt(dailySummaryHour),
          p_minute: parseInt(dailySummaryMinute),
        });
      } else {
        await (supabase.rpc as any)('disable_calendar_physical_summary_cron');
      }
    } catch (e) {
      console.error('Daily summary cron update error:', e);
    }
  };

  const handleSaveBaserow = async () => {
    setIsSavingBaserow(true);
    try {
      const { error } = await supabase
        .from('baserow_integrations')
        .upsert({
          module: 'agenda',
          is_enabled: baserowEnabled,
          api_url: baserowApiUrl,
          api_token: baserowToken,
          table_id: baserowTableId,
          events: baserowEvents,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('module', 'agenda');
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['baserow-config-agenda'] });
      toast.success('Configuração Baserow salva!');
    } catch (err: any) {
      toast.error('Erro ao salvar Baserow: ' + err.message);
    } finally {
      setIsSavingBaserow(false);
    }
  };

  const handleAddInstance = async () => {
    if (!newInstanceUrl || !newInstanceKey || !newInstanceName) {
      toast.error('Preencha todos os campos da instância');
      return;
    }
    const { error } = await supabase.from('calendar_notification_whatsapp_instances').insert({
      api_url: newInstanceUrl,
      api_key: newInstanceKey,
      instance_name: newInstanceName,
    });
    if (error) {
      toast.error('Erro ao adicionar instância');
      return;
    }
    toast.success('Instância adicionada!');
    setNewInstanceUrl('');
    setNewInstanceKey('');
    setNewInstanceName('');
    refetchInstances();
  };

  const handleDeleteInstance = async (id: string) => {
    await supabase.from('calendar_notification_whatsapp_instances').delete().eq('id', id);
    toast.success('Instância removida');
    refetchInstances();
  };

  const handleToggleInstance = async (id: string, active: boolean) => {
    await supabase.from('calendar_notification_whatsapp_instances').update({ is_active: active }).eq('id', id);
    refetchInstances();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Google Calendar Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Google Agenda</CardTitle>
          </div>
          <CardDescription>
            Configure as credenciais do Google Calendar para criação automática de links do Google Meet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label>Integração ativa</Label>
              <Badge variant="outline" className="text-[10px]">
                {googleEnabled ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <Switch checked={googleEnabled} onCheckedChange={setGoogleEnabled} />
          </div>

          {googleEnabled && (
            <div className="space-y-3 pl-1">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <p>
                    Para obter as credenciais, acesse o{' '}
                    <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                      Google Cloud Console <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>
              <TooltipProvider delayDuration={200}>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Client ID
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[320px] text-xs">Acesse Google Cloud Console → APIs → Credenciais OAuth</TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input placeholder="Seu Google Client ID" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input type="password" placeholder="Seu Google Client Secret" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Refresh Token</Label>
                  <Input type="password" placeholder="Seu Google Refresh Token" value={googleRefreshToken} onChange={(e) => setGoogleRefreshToken(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>ID do Calendário</Label>
                  <Input placeholder="Ex: seuemail@gmail.com (ou 'primary')" value={googleCalendarId} onChange={(e) => setGoogleCalendarId(e.target.value)} />
                </div>
              </TooltipProvider>

              {/* Auto Sync */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <Label>Sincronização automática</Label>
                    <Badge variant="outline" className="text-[10px]">{autoSyncEnabled ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                  <Switch checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} />
                </div>
                {autoSyncEnabled && (
                  <div className="mt-3 space-y-2">
                    <Label>Intervalo de sincronização</Label>
                    <Select value={syncInterval} onValueChange={setSyncInterval}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">A cada 5 minutos</SelectItem>
                        <SelectItem value="10">A cada 10 minutos</SelectItem>
                        <SelectItem value="15">A cada 15 minutos</SelectItem>
                        <SelectItem value="30">A cada 30 minutos</SelectItem>
                        <SelectItem value="60">A cada 1 hora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Independent Notifications Config */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Notificações</CardTitle>
          </div>
          <CardDescription>
            Configure notificações automáticas independentes para o módulo Agenda.
            <br />
            <span className="text-xs text-muted-foreground">⚠️ Somente para eventos criados no sistema. Eventos importados do Google Calendar não recebem notificações.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label>Notificar clientes</Label>
              <Badge variant="outline" className="text-[10px]">{notifyEnabled ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} />
          </div>

          {notifyEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Horas antes da reunião</Label>
                  <Select value={notifyHoursBefore} onValueChange={setNotifyHoursBefore}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="2">2 horas</SelectItem>
                      <SelectItem value="3">3 horas</SelectItem>
                      <SelectItem value="6">6 horas</SelectItem>
                      <SelectItem value="12">12 horas</SelectItem>
                      <SelectItem value="24">24 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={notifyChannel} onValueChange={setNotifyChannel}>
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
                <Label>Modelo da Mensagem</Label>
                <Textarea
                  placeholder="Use {client_name}, {date}, {time}, {meet_link}, {title} como variáveis"
                  value={notifyTemplate}
                  onChange={(e) => setNotifyTemplate(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {'{client_name}'}, {'{date}'}, {'{time}'}, {'{meet_link}'}, {'{title}'}
                </p>
              </div>

              {/* Cron Config */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    <Label>Envio automático (Cron)</Label>
                    <Badge variant="outline" className="text-[10px]">{notifyCronEnabled ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                  <Switch checked={notifyCronEnabled} onCheckedChange={setNotifyCronEnabled} />
                </div>
                {notifyCronEnabled && (
                  <div className="mt-3 space-y-2">
                    <Label>Intervalo de verificação</Label>
                    <Select value={notifyCronInterval} onValueChange={setNotifyCronInterval}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">A cada 1 minuto</SelectItem>
                        <SelectItem value="5">A cada 5 minutos</SelectItem>
                        <SelectItem value="15">A cada 15 minutos</SelectItem>
                        <SelectItem value="30">A cada 30 minutos</SelectItem>
                        <SelectItem value="60">A cada 1 hora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Instances Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">Instâncias WhatsApp</CardTitle>
          </div>
          <CardDescription>Adicione as instâncias da Evolution API para envio dos lembretes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="URL da API" value={newInstanceUrl} onChange={(e) => setNewInstanceUrl(e.target.value)} />
            <Input placeholder="API Key" value={newInstanceKey} onChange={(e) => setNewInstanceKey(e.target.value)} />
            <div className="flex gap-2">
              <Input placeholder="Nome da Instância" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} />
              <Button onClick={handleAddInstance} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="border rounded-lg divide-y">
            {whatsappInstances.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">Nenhuma instância cadastrada</p>
            ) : (
              whatsappInstances.map((inst) => (
                <div key={inst.id} className="p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{inst.instance_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{inst.api_url}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={inst.is_active} onCheckedChange={(checked) => handleToggleInstance(inst.id, checked)} />
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteInstance(inst.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gmail Config Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-red-500" />
            <CardTitle className="text-lg">E-mail (Gmail/SMTP)</CardTitle>
          </div>
          <CardDescription>Configure o envio de e-mails para os clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Gmail User</Label>
              <Input placeholder="seuemail@gmail.com" value={notifyGmailUser} onChange={(e) => setNotifyGmailUser(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>App Password</Label>
              <Input type="password" placeholder="Senha de app do Google" value={notifyGmailPassword} onChange={(e) => setNotifyGmailPassword(e.target.value)} />
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Para o Gmail, você precisa criar uma "Senha de App" nas configurações de segurança da sua conta Google (2FA obrigatório).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Baserow Integration Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Integração Baserow
              </CardTitle>
              <CardDescription>
                Crie leads automaticamente no Baserow quando notificações da agenda forem enviadas para o cliente.
              </CardDescription>
            </div>
            <Switch checked={baserowEnabled} onCheckedChange={setBaserowEnabled} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p>📦 Quando uma notificação for enviada para o cliente, o sistema cria automaticamente 2 linhas no Baserow:</p>
            <p>• Uma com o número no formato <code className="bg-muted px-1 rounded">@s.whatsapp.net</code></p>
            <p>• Outra com o número no formato <code className="bg-muted px-1 rounded">+número</code></p>
          </div>

          <div className="space-y-2">
            <Label>URL da API Baserow</Label>
            <Input
              placeholder="https://baserow.seudominio.com"
              value={baserowApiUrl}
              onChange={e => setBaserowApiUrl(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Token da API</Label>
              <div className="relative">
                <Input
                  type={showBaserowToken ? 'text' : 'password'}
                  placeholder="Token"
                  value={baserowToken}
                  onChange={e => setBaserowToken(e.target.value)}
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
                onChange={e => setBaserowTableId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Eventos que criam leads</Label>
            <div className="flex flex-wrap gap-2">
              {['agenda.online', 'agenda.presencial'].map(evt => (
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
                  {evt === 'agenda.online' ? 'Reunião Online' : 'Reunião Presencial'} ({evt})
                </Badge>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleSaveBaserow} 
            disabled={isSavingBaserow}
            className="w-full bg-primary"
          >
            {isSavingBaserow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configuração Baserow
          </Button>
        </CardContent>
      </Card>

      {/* History Log Manager */}
      {notificationLogs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Histórico de Notificações</CardTitle>
            </div>
            <CardDescription>Últimos envios realizados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notificationLogs.map((log) => (
                <div key={log.id} className="text-xs border rounded-lg p-2 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="text-[10px]">
                        {log.status === 'sent' ? 'Enviado' : 'Erro'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {log.channel === 'whatsapp' ? <MessageSquare className="h-3 w-3 mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                        {log.channel}
                      </Badge>
                      <span className="text-muted-foreground">
                        {log.recipient_name || log.recipient_contact}
                      </span>
                    </div>
                    {log.error_message && <p className="text-destructive mt-1">{log.error_message}</p>}
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo Diário do Consultor (Presencial) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">Resumo Diário do Consultor</CardTitle>
          </div>
          <CardDescription>
            Envia uma mensagem de WhatsApp para o(a) consultor(a) com a lista de visitas presenciais agendadas para o dia, em um horário pré-definido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label>Envio automático ativo</Label>
              <Badge variant="outline" className="text-[10px]">{dailySummaryEnabled ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            <Switch checked={dailySummaryEnabled} onCheckedChange={setDailySummaryEnabled} />
          </div>

          {dailySummaryEnabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Hora (Brasília)</Label>
                  <Select value={dailySummaryHour} onValueChange={setDailySummaryHour}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}h</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Minuto</Label>
                  <Select value={dailySummaryMinute} onValueChange={setDailySummaryMinute}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">:00</SelectItem>
                      <SelectItem value="15">:15</SelectItem>
                      <SelectItem value="30">:30</SelectItem>
                      <SelectItem value="45">:45</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg flex items-start gap-2">
                <Info className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <p className="text-xs text-purple-700 dark:text-purple-400">
                  O sistema irá disparar o resumo todos os dias às <strong>{String(dailySummaryHour).padStart(2,'0')}:{String(dailySummaryMinute).padStart(2,'0')}</strong> (horário de Brasília) para os telefones cadastrados no campo "Consultores" de cada visita presencial.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações Gerais
        </Button>
      </div>
    </div>
  );
}
