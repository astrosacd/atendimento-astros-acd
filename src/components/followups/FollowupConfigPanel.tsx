import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Settings, Clock, Webhook, Plus, Trash2, Save, Timer, Eye, EyeOff, Sparkles, Bot, Database,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TagInput } from '@/components/TagInput';

interface FollowupWebhook {
  id: string;
  nome: string;
  url: string;
  secret_key: string | null;
  eventos: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  followup_id: string | null;
  evento: string;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  created_at: string;
}

const AVAILABLE_EVENTS = ['followup.sent', 'followup.failed'];

export function FollowupConfigPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();

  // Config queries
  const { data: configs = [], isLoading: configLoading } = useQuery({
    queryKey: ['followup-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('followup_config')
        .select('*');
      if (error) throw error;
      return data as { id: string; config_key: string; config_value: string }[];
    },
    enabled: open,
  });

  const getConfigValue = (key: string, fallback: string) =>
    configs.find(c => c.config_key === key)?.config_value || fallback;

  const [delaySeconds, setDelaySeconds] = useState('10');
  const [cronHour, setCronHour] = useState('9');
  const [cronMinute, setCronMinute] = useState('0');
  const [aiMessageEnabled, setAiMessageEnabled] = useState(false);
  const [externalAnonKey, setExternalAnonKey] = useState('');
  const [baserowApiUrl, setBaserowApiUrl] = useState('');
  const [baserowToken, setBaserowToken] = useState('');
  const [baserowTableId, setBaserowTableId] = useState('');
  const [baserowEnabled, setBaserowEnabled] = useState(false);
  const [baserowEvents, setBaserowEvents] = useState<string[]>(['followup.sent', 'followup.failed']);
  const [showBaserowToken, setShowBaserowToken] = useState(false);
  const [isSavingBaserow, setIsSavingBaserow] = useState(false);

  // Baserow config (separate from followup_config, uses baserow_integrations table)
  const { data: baserowConfig } = useQuery({
    queryKey: ['baserow-config-followups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baserow_integrations')
        .select('*')
        .eq('module', 'followups')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (baserowConfig) {
      setBaserowEnabled(baserowConfig.is_enabled ?? false);
      setBaserowApiUrl(baserowConfig.api_url || '');
      setBaserowToken(baserowConfig.api_token || '');
      setBaserowTableId(baserowConfig.table_id || '');
      setBaserowEvents(baserowConfig.events || []);
    }
  }, [baserowConfig]);

  useEffect(() => {
    if (configs.length > 0) {
      setDelaySeconds(getConfigValue('delay_seconds', '10'));
      setCronHour(getConfigValue('cron_hour', '9'));
      setCronMinute(getConfigValue('cron_minute', '0'));
      setAiMessageEnabled(getConfigValue('ai_message_enabled', 'false') === 'true');
      setExternalAnonKey(getConfigValue('external_supabase_anon_key', ''));
      setBaserowApiUrl(getConfigValue('baserow_api_url', ''));
      setBaserowToken(getConfigValue('baserow_token', ''));
      setBaserowTableId(getConfigValue('baserow_table_id', ''));
      setBaserowEnabled(getConfigValue('baserow_enabled', 'false') === 'true');
    }
  }, [configs]);

  // Cron schedule query
  const { data: cronSchedule } = useQuery({
    queryKey: ['followup-cron-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_followup_cron_schedule');
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: open,
  });

  // Save config mutation
  const saveConfig = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: 'delay_seconds', value: delaySeconds },
        { key: 'ai_message_enabled', value: aiMessageEnabled ? 'true' : 'false' },
        { key: 'external_supabase_anon_key', value: externalAnonKey },
      ];
      for (const u of updates) {
        const { data: existing } = await supabase
          .from('followup_config')
          .select('id')
          .eq('config_key', u.key)
          .single();
        if (existing) {
          await supabase
            .from('followup_config')
            .update({ config_value: u.value } as any)
            .eq('config_key', u.key);
        } else {
          await supabase
            .from('followup_config')
            .insert({ config_key: u.key, config_value: u.value } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-config'] });
      toast.success('Configurações salvas!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  // Webhooks
  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery({
    queryKey: ['followup-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('followup_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FollowupWebhook[];
    },
    enabled: open,
  });

  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ nome: '', url: '', secret_key: '', eventos: AVAILABLE_EVENTS });
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
  const [viewLogsId, setViewLogsId] = useState<string | null>(null);

  const createWebhook = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('followup_webhooks').insert({
        nome: webhookForm.nome,
        url: webhookForm.url,
        secret_key: webhookForm.secret_key || null,
        eventos: webhookForm.eventos,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-webhooks'] });
      toast.success('Webhook criado!');
      setShowWebhookForm(false);
      setWebhookForm({ nome: '', url: '', secret_key: '', eventos: AVAILABLE_EVENTS });
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('followup_webhooks')
        .update({ is_active: active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['followup-webhooks'] }),
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('followup_webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-webhooks'] });
      toast.success('Webhook excluído');
      setDeleteWebhookId(null);
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });

  // Webhook logs
  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['followup-webhook-logs', viewLogsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('followup_webhook_logs')
        .select('*')
        .eq('webhook_id', viewLogsId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as WebhookLog[];
    },
    enabled: !!viewLogsId,
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Follow-ups
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1 gap-1">
              <Timer className="h-4 w-4" /> Geral
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex-1 gap-1">
              <Webhook className="h-4 w-4" /> Webhooks
            </TabsTrigger>
          </TabsList>

          {/* General Config Tab */}
          <TabsContent value="general" className="space-y-6 mt-4">
            {configLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : (
              <>
                {/* Delay Config */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Timer className="h-4 w-4 text-primary" />
                      Intervalo entre Disparos
                    </CardTitle>
                    <CardDescription>
                      Tempo mínimo entre cada envio na fila. O sistema processa 1 follow-up por vez, respeitando esse intervalo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="60"
                        max="600"
                        value={delaySeconds}
                        onChange={e => setDelaySeconds(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">segundos (mín. 60)</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Queue Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Sistema de Fila
                    </CardTitle>
                    <CardDescription>
                      O cron roda automaticamente a cada minuto verificando a fila de pendentes. Cada execução processa 1 follow-up, garantindo que todos sejam enviados sem timeout.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cronSchedule && (
                      <p className="text-xs text-muted-foreground">
                        Cron ativo: <code className="bg-muted px-1 rounded">{cronSchedule.schedule}</code> (a cada minuto)
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      💡 Os follow-ups são agendados pela data/hora que você define ao criar. O sistema verifica a cada minuto se há pendências e envia 1 por vez.
                    </p>
                  </CardContent>
                </Card>

                {/* AI Message Generation */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      Mensagem com IA
                    </CardTitle>
                    <CardDescription>
                      Quando habilitado, o formulário de follow-up terá um botão para gerar mensagens automaticamente com IA, consultando o catálogo de produtos cadastrados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Habilitar geração por IA</Label>
                        <p className="text-xs text-muted-foreground">
                          A IA consulta o catálogo de produtos para criar mensagens personalizadas
                        </p>
                      </div>
                      <Switch
                        checked={aiMessageEnabled}
                        onCheckedChange={setAiMessageEnabled}
                      />
                    </div>
                    {aiMessageEnabled && (
                      <div className="space-y-4">
                        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                          <p>✨ Para melhores resultados, cadastre seus produtos no catálogo (Admin → menu lateral).</p>
                          <p>🔍 A IA busca o produto pelo nome de interesse e gera uma mensagem contextual.</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Anon Key do Projeto Externo
                          </Label>
                          <Input
                            type="password"
                            value={externalAnonKey}
                            onChange={e => setExternalAnonKey(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIs..."
                          />
                          <p className="text-xs text-muted-foreground">
                            Chave anônima do projeto externo que contém a base de produtos. Deixe vazio para usar apenas o catálogo interno.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {saveConfig.isPending ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </>
            )}
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Webhooks disparam a cada envio de follow-up
              </p>
              <Button size="sm" onClick={() => setShowWebhookForm(true)} className="shrink-0">
                <Plus className="h-4 w-4 mr-1" /> Novo Webhook
              </Button>
            </div>

            {webhooksLoading ? (
              <Skeleton className="h-32" />
            ) : webhooks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum webhook configurado
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {webhooks.map(wh => (
                  <Card key={wh.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold">{wh.nome}</span>
                            <Badge variant={wh.is_active ? 'default' : 'secondary'} className="text-xs">
                              {wh.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground break-all">{wh.url}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {wh.eventos.map(e => (
                              <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={wh.is_active}
                            onCheckedChange={checked => toggleWebhook.mutate({ id: wh.id, active: checked })}
                          />
                          <Button variant="ghost" size="icon" onClick={() => setViewLogsId(wh.id)} title="Ver logs">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteWebhookId(wh.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Webhook Form */}
            <Dialog open={showWebhookForm} onOpenChange={setShowWebhookForm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Webhook</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input value={webhookForm.nome} onChange={e => setWebhookForm(f => ({ ...f, nome: e.target.value }))} placeholder="Meu Webhook" />
                  </div>
                  <div>
                    <Label>URL</Label>
                    <Input value={webhookForm.url} onChange={e => setWebhookForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div>
                    <Label>Secret Key (opcional)</Label>
                    <Input value={webhookForm.secret_key} onChange={e => setWebhookForm(f => ({ ...f, secret_key: e.target.value }))} placeholder="Chave secreta" />
                  </div>
                  <div>
                    <Label>Eventos</Label>
                    <div className="flex gap-3 mt-1">
                      {AVAILABLE_EVENTS.map(evt => (
                        <label key={evt} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={webhookForm.eventos.includes(evt)}
                            onChange={e => {
                              setWebhookForm(f => ({
                                ...f,
                                eventos: e.target.checked
                                  ? [...f.eventos, evt]
                                  : f.eventos.filter(x => x !== evt),
                              }));
                            }}
                          />
                          {evt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowWebhookForm(false)}>Cancelar</Button>
                  <Button onClick={() => createWebhook.mutate()} disabled={!webhookForm.nome || !webhookForm.url || createWebhook.isPending}>
                    {createWebhook.isPending ? 'Criando...' : 'Criar Webhook'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteWebhookId} onOpenChange={() => setDeleteWebhookId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteWebhookId && deleteWebhook.mutate(deleteWebhookId)} className="bg-destructive text-destructive-foreground">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Webhook Logs Dialog */}
            <Dialog open={!!viewLogsId} onOpenChange={() => setViewLogsId(null)}>
              <DialogContent className="max-w-xl max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Logs do Webhook</DialogTitle>
                </DialogHeader>
                {webhookLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum log encontrado</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhookLogs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">
                            {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{log.evento}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.response_status || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={log.success ? 'default' : 'destructive'} className="text-[10px]">
                              {log.success ? 'OK' : 'Erro'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
