import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Save, Loader2, Plus, X, Send, Clock, MessageSquare, Mail, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReminderConfig {
  id: string;
  is_active: boolean;
  status_to_monitor: string[];
  cron_interval_hours: number;
  cron_start_hour: number;
  cron_end_hour: number;
  cron_days: string[];
  whatsapp_enabled: boolean;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  whatsapp_group_id: string | null;
  whatsapp_mention_all: boolean;
  gmail_enabled: boolean;
  gmail_user: string | null;
  gmail_app_password: string | null;
  gmail_recipients: string[];
  gmail_subject_template: string;
  message_template: string;
}

interface ReminderLog {
  id: string;
  channel: string;
  status: string;
  numbers_count: number;
  numbers_list: string[] | null;
  status_monitored: string | null;
  error_message: string | null;
  sent_at: string;
}

const DAYS_OF_WEEK = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
];

export function ReminderConfigTab() {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const [config, setConfig] = useState<ReminderConfig>({
    id: '',
    is_active: false,
    status_to_monitor: [],
    cron_interval_hours: 1,
    cron_start_hour: 8,
    cron_end_hour: 18,
    cron_days: ['1', '2', '3', '4', '5', '6'],
    whatsapp_enabled: false,
    evolution_api_url: '',
    evolution_api_key: '',
    evolution_instance_name: '',
    whatsapp_group_id: '',
    whatsapp_mention_all: true,
    gmail_enabled: false,
    gmail_user: '',
    gmail_app_password: '',
    gmail_recipients: [],
    gmail_subject_template: '🛑 Atenção: {count} número(s) para desbanimento',
    message_template: '🛑 Atenção, tem {count} numero(s) para ser(em) desbanido(s)!\n\n{numbers}',
  });

  // Fetch config
  const { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ['consulta-numeros-reminder-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_reminder_config')
        .select('*')
        .single();
      if (error) throw error;
      return data as ReminderConfig;
    },
  });

  // Fetch available statuses from Baserow (excluido_da_base)
  const {
    data: availableStatuses = [],
    isLoading: loadingStatuses,
    isFetching: fetchingStatuses,
    refetch: refetchStatuses,
  } = useQuery({
    queryKey: ['consulta-numeros-reminder-available-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('consulta-numeros-reminder', {
        body: { action: 'list_statuses' },
      });
      if (error) throw error;
      return (data?.statuses as string[]) || [];
    },
  });

  // Fetch logs
  const { data: logs = [] } = useQuery({
    queryKey: ['consulta-numeros-reminder-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_reminder_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as ReminderLog[];
    },
  });

  useEffect(() => {
    if (configData) {
      setConfig({
        ...configData,
        evolution_api_url: configData.evolution_api_url || '',
        evolution_api_key: configData.evolution_api_key || '',
        evolution_instance_name: configData.evolution_instance_name || '',
        whatsapp_group_id: configData.whatsapp_group_id || '',
        gmail_user: configData.gmail_user || '',
        gmail_app_password: configData.gmail_app_password || '',
        gmail_recipients: configData.gmail_recipients || [],
        status_to_monitor: configData.status_to_monitor || [],
        cron_days: configData.cron_days || ['1', '2', '3', '4', '5', '6'],
      });
    }
  }, [configData]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('consulta_numeros_reminder_config')
        .update({
          is_active: config.is_active,
          status_to_monitor: config.status_to_monitor,
          cron_interval_hours: config.cron_interval_hours,
          cron_start_hour: config.cron_start_hour,
          cron_end_hour: config.cron_end_hour,
          cron_days: config.cron_days,
          whatsapp_enabled: config.whatsapp_enabled,
          evolution_api_url: config.evolution_api_url || null,
          evolution_api_key: config.evolution_api_key || null,
          evolution_instance_name: config.evolution_instance_name || null,
          whatsapp_group_id: config.whatsapp_group_id || null,
          whatsapp_mention_all: config.whatsapp_mention_all,
          gmail_enabled: config.gmail_enabled,
          gmail_user: config.gmail_user || null,
          gmail_app_password: config.gmail_app_password || null,
          gmail_recipients: config.gmail_recipients,
          gmail_subject_template: config.gmail_subject_template,
          message_template: config.message_template,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Configurações salvas!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-reminder-config'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });

  const handleAddStatus = () => {
    if (!newStatus.trim()) return;
    if (config.status_to_monitor.includes(newStatus.trim())) {
      toast({ title: 'Status já adicionado', variant: 'destructive' });
      return;
    }
    setConfig(prev => ({
      ...prev,
      status_to_monitor: [...prev.status_to_monitor, newStatus.trim()],
    }));
    setNewStatus('');
  };

  const handleRemoveStatus = (status: string) => {
    setConfig(prev => ({
      ...prev,
      status_to_monitor: prev.status_to_monitor.filter(s => s !== status),
    }));
  };

  const handleAddRecipient = () => {
    const email = newRecipient.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    if (config.gmail_recipients.includes(email)) {
      toast({ title: 'Email já adicionado', variant: 'destructive' });
      return;
    }
    setConfig(prev => ({
      ...prev,
      gmail_recipients: [...prev.gmail_recipients, email],
    }));
    setNewRecipient('');
  };

  const handleRemoveRecipient = (email: string) => {
    setConfig(prev => ({
      ...prev,
      gmail_recipients: prev.gmail_recipients.filter(e => e !== email),
    }));
  };

  const handleDayToggle = (day: string) => {
    setConfig(prev => ({
      ...prev,
      cron_days: prev.cron_days.includes(day)
        ? prev.cron_days.filter(d => d !== day)
        : [...prev.cron_days, day],
    }));
  };

  const handleTestReminder = async () => {
    setTestLoading(true);
    try {
      // Pass force: true to skip time/day validations during test
      const { data, error } = await supabase.functions.invoke('consulta-numeros-reminder', {
        body: { force: true }
      });
      if (error) throw error;
      
      if (data?.success && data?.results?.length > 0) {
        toast({
          title: 'Teste executado!',
          description: `Encontrados ${data.count || 0} números. ${data.results.map((r: { channel: string; status: string }) => `${r.channel}: ${r.status}`).join(', ')}`,
        });
      } else if (data?.success && data?.count > 0) {
        toast({
          title: 'Números encontrados mas nenhum canal configurado',
          description: `Encontrados ${data.count} números. Configure WhatsApp ou Gmail para enviar.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Resultado do teste',
          description: data?.message || 'Nenhum número encontrado com os status monitorados',
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-reminder-logs'] });
    } catch (error) {
      console.error('Test error:', error);
      toast({ title: 'Erro no teste', description: String(error), variant: 'destructive' });
    } finally {
      setTestLoading(false);
    }
  };

  if (loadingConfig) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Lembretes Automáticos
          </CardTitle>
          <CardDescription>
            Configure lembretes automáticos para números com status específicos (ex: EM ANÁLISE PELA META).
            Os lembretes serão enviados via WhatsApp e/ou Email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ativar/Desativar */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Lembretes Ativos</p>
              <p className="text-sm text-muted-foreground">Ativar/desativar o envio automático de lembretes</p>
            </div>
            <Switch
              checked={config.is_active}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, is_active: checked }))}
            />
          </div>

          {/* Status a Monitorar */}
          <div className="space-y-3">
            <Label>Status a Monitorar (campo: excluido_da_base)</Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Escolher da lista</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingStatuses ? 'Carregando...' : 'Selecione um status'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        Nenhum status encontrado
                      </SelectItem>
                    ) : (
                      availableStatuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const status = selectedStatus?.trim();
                      if (!status || status === '__none__') return;
                      if (config.status_to_monitor.includes(status)) {
                        toast({ title: 'Status já adicionado', variant: 'destructive' });
                        return;
                      }
                      setConfig((prev) => ({
                        ...prev,
                        status_to_monitor: [...prev.status_to_monitor, status],
                      }));
                      setSelectedStatus('');
                    }}
                    disabled={!selectedStatus || selectedStatus === '__none__'}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={fetchingStatuses}
                    onClick={async () => {
                      try {
                        await refetchStatuses();
                        toast({ title: 'Lista atualizada!' });
                      } catch (e: any) {
                        toast({
                          title: 'Erro ao atualizar lista',
                          description: e?.message || String(e),
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    {fetchingStatuses ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      'Atualizar lista'
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ou digitar manualmente</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: EM ANÁLISE PELA META"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStatus()}
                  />
                  <Button onClick={handleAddStatus} variant="outline" type="button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {config.status_to_monitor.map((status) => (
                <Badge key={status} variant="secondary" className="gap-1">
                  {status}
                  <button onClick={() => handleRemoveStatus(status)} className="ml-1 hover:text-destructive" type="button">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {config.status_to_monitor.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum status configurado</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              O lembrete filtra pelo campo <code className="bg-muted px-1 rounded">excluido_da_base</code>.
            </p>
          </div>

          {/* Configuração do Cron */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5" />
              <h4 className="font-medium">Agendamento</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Intervalo</Label>
                <Select
                  value={config.cron_interval_hours.toString()}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, cron_interval_hours: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">A cada 1 hora</SelectItem>
                    <SelectItem value="2">A cada 2 horas</SelectItem>
                    <SelectItem value="3">A cada 3 horas</SelectItem>
                    <SelectItem value="4">A cada 4 horas</SelectItem>
                    <SelectItem value="6">A cada 6 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Horário Início</Label>
                <Select
                  value={config.cron_start_hour.toString()}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, cron_start_hour: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Horário Fim</Label>
                <Select
                  value={config.cron_end_hour.toString()}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, cron_end_hour: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>{i.toString().padStart(2, '0')}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.cron_days.includes(day.value)}
                      onCheckedChange={() => handleDayToggle(day.value)}
                    />
                    <span className="text-sm">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* WhatsApp Config */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <h4 className="font-medium">WhatsApp (Evolution API)</h4>
              </div>
              <Switch
                checked={config.whatsapp_enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, whatsapp_enabled: checked }))}
              />
            </div>

            {config.whatsapp_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label>URL da API Evolution</Label>
                  <Input
                    placeholder="https://api.evolution.com.br"
                    value={config.evolution_api_url || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, evolution_api_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="Sua API Key"
                    value={config.evolution_api_key || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, evolution_api_key: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Instância</Label>
                  <Input
                    placeholder="Ex: minha_instancia"
                    value={config.evolution_instance_name || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, evolution_instance_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID do Grupo</Label>
                  <Input
                    placeholder="Ex: 120363396099545678@g.us"
                    value={config.whatsapp_group_id || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_group_id: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.whatsapp_mention_all}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, whatsapp_mention_all: checked === true }))}
                    />
                    <span className="text-sm">Mencionar todos (@everyone)</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Gmail Config */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <h4 className="font-medium">Email (Gmail)</h4>
              </div>
              <Switch
                checked={config.gmail_enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, gmail_enabled: checked }))}
              />
            </div>

            {config.gmail_enabled && (
              <div className="space-y-4 pl-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email do Gmail</Label>
                    <Input
                      type="email"
                      placeholder="seuemail@gmail.com"
                      value={config.gmail_user || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, gmail_user: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha de App</Label>
                    <Input
                      type="password"
                      placeholder="Senha de app de 16 caracteres"
                      value={config.gmail_app_password || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, gmail_app_password: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Destinatários</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="destinatario@email.com"
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddRecipient();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddRecipient} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {config.gmail_recipients.map((email) => (
                      <Badge key={email} variant="secondary" className="gap-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(email)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Assunto do Email</Label>
                  <Input
                    placeholder="🛑 Atenção: {count} número(s) para desbanimento"
                    value={config.gmail_subject_template}
                    onChange={(e) => setConfig(prev => ({ ...prev, gmail_subject_template: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Message Template */}
          <div className="border-t pt-6 space-y-4">
            <Label>Template da Mensagem</Label>
            <Textarea
              placeholder="🛑 Atenção, tem {count} numero(s) para ser(em) desbanido(s)!\n\n{numbers}"
              value={config.message_template}
              onChange={(e) => setConfig(prev => ({ ...prev, message_template: e.target.value }))}
              rows={4}
            />
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Variáveis disponíveis:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 rounded">{'{count}'}</code> - Quantidade total de números encontrados</li>
                <li><code className="bg-muted px-1 rounded">{'{nationals}'}</code> - Quantidade de números nacionais (🇧🇷)</li>
                <li><code className="bg-muted px-1 rounded">{'{internationals}'}</code> - Quantidade de números internacionais (🌍)</li>
                <li><code className="bg-muted px-1 rounded">{'{numbers}'}</code> - Lista dos números com status e tipo (Nacional/Internacional)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Nota:</strong> Cada número será exibido no formato: <code className="bg-muted px-1 rounded">número - status - 🇧🇷 Nacional</code> ou <code className="bg-muted px-1 rounded">número - status - 🌍 Internacional</code>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
              {saveConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
            <Button variant="outline" onClick={handleTestReminder} disabled={testLoading}>
              {testLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Testar Agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Qtd Números</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum envio registrado
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.channel === 'whatsapp' ? 'default' : 'secondary'}>
                          {log.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                          {log.status === 'success' ? 'Sucesso' : 'Erro'}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.numbers_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
