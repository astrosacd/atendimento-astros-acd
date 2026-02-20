import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Webhook, Plus, Trash2, Edit2, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronRight, RefreshCw, Eye,
} from 'lucide-react';

interface RecoveryWebhook {
  id: string;
  nome: string;
  url: string;
  secret_key: string | null;
  is_active: boolean;
  eventos: string[];
  last_triggered_at: string | null;
  created_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  evento: string;
  payload: any;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  created_at: string;
}

const EVENTOS = [
  { value: 'recovery.inadimplente', label: 'Inadimplente', color: 'text-red-400' },
  { value: 'recovery.registro', label: 'Cliente Registro', color: 'text-purple-400' },
];

const emptyForm = { nome: '', url: '', secret_key: '', eventos: ['recovery.inadimplente', 'recovery.registro'] as string[], is_active: true };

export function RecoveryWebhooksManager() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<RecoveryWebhook[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editWebhook, setEditWebhook] = useState<RecoveryWebhook | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => { loadWebhooks(); }, []);

  const loadWebhooks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-recovery', {
        body: { action: 'list-webhooks' },
      });
      if (error) throw error;
      setWebhooks(data.webhooks || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar webhooks', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-recovery', {
        body: { action: 'list-webhook-logs' },
      });
      if (error) throw error;
      setLogs(data.logs || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar logs', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingLogs(false);
    }
  };

  const openCreate = () => {
    setEditWebhook(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (wh: RecoveryWebhook) => {
    setEditWebhook(wh);
    setForm({ nome: wh.nome, url: wh.url, secret_key: wh.secret_key || '', eventos: wh.eventos, is_active: wh.is_active });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.nome || !form.url) {
      toast({ title: 'Preencha nome e URL', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const action = editWebhook ? 'update-webhook' : 'create-webhook';
      const body: any = { action, nome: form.nome, url: form.url, secret_key: form.secret_key || null, eventos: form.eventos, is_active: form.is_active };
      if (editWebhook) body.webhookId = editWebhook.id;
      const { error } = await supabase.functions.invoke('client-recovery', { body });
      if (error) throw error;
      toast({ title: editWebhook ? 'Webhook atualizado!' : 'Webhook criado!' });
      setShowForm(false);
      loadWebhooks();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteWebhook = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.functions.invoke('client-recovery', {
        body: { action: 'delete-webhook', webhookId: deleteId },
      });
      if (error) throw error;
      toast({ title: 'Webhook removido!' });
      setDeleteId(null);
      loadWebhooks();
    } catch (e: any) {
      toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' });
    }
  };

  const toggleEvento = (ev: string) => {
    setForm(f => ({
      ...f,
      eventos: f.eventos.includes(ev) ? f.eventos.filter(e => e !== ev) : [...f.eventos, ev],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-blue-400" />
                Webhooks de Recuperação
              </CardTitle>
              <CardDescription>
                Disparo automático para cada mensagem enviada (inadimplente ou registro)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowLogs(v => !v); if (!showLogs) loadLogs(); }}>
                <Eye className="w-4 h-4 mr-2" />
                {showLogs ? 'Ocultar Logs' : 'Ver Logs'}
              </Button>
              <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-blue-500 to-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Novo Webhook
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Payload info */}
          <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">📦 Payload enviado em cada disparo:</p>
            <pre className="overflow-x-auto text-xs leading-relaxed">{`{
  "evento": "recovery.inadimplente" | "recovery.registro",
  "tipo": "Inadimplente" | "Cliente Registro",
  "cliente": { "nome": "...", "produto": "..." },
  "canal": "WhatsApp" | "Email",
  "contato": "<número ou e-mail>",
  "mensagem_enviada": "...",
  "enviado_em": "<ISO datetime>"
}`}</pre>
          </div>

          {/* Webhook list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum webhook configurado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map(wh => (
                <div key={wh.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{wh.nome}</span>
                      {wh.is_active
                        ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Ativo</Badge>
                        : <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      }
                      {wh.eventos.map(ev => {
                        const e = EVENTOS.find(x => x.value === ev);
                        return e ? <Badge key={ev} variant="outline" className={`text-xs ${e.color}`}>{e.label}</Badge> : null;
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{wh.url}</p>
                    {wh.last_triggered_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Último disparo: {new Date(wh.last_triggered_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(wh)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setDeleteId(wh.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      {showLogs && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Logs de Disparos
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={loadLogs} disabled={loadingLogs}>
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">Nenhum log registrado</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="rounded-lg border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedLogs(expandedLogs === log.id ? null : log.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        {log.success
                          ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        }
                        <span className="text-xs font-mono text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                        <Badge variant="outline" className={`text-xs ${log.evento === 'recovery.inadimplente' ? 'text-red-400' : 'text-purple-400'}`}>
                          {log.evento === 'recovery.inadimplente' ? 'Inadimplente' : 'Registro'}
                        </Badge>
                        {log.response_status && (
                          <span className={`text-xs font-mono ${log.success ? 'text-emerald-400' : 'text-red-400'}`}>
                            HTTP {log.response_status}
                          </span>
                        )}
                      </div>
                      {expandedLogs === log.id
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                    </button>
                    {expandedLogs === log.id && (
                      <div className="border-t border-border/50 p-3 space-y-2 bg-muted/20">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Payload:</p>
                          <pre className="text-xs overflow-x-auto bg-background/50 rounded p-2 border border-border/30">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                        {log.response_body && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Resposta:</p>
                            <pre className="text-xs overflow-x-auto bg-background/50 rounded p-2 border border-border/30 max-h-24">
                              {log.response_body}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editWebhook ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Meu n8n" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>URL do Webhook</Label>
              <Input placeholder="https://..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Chave Secreta <span className="text-muted-foreground">(opcional)</span></Label>
              <Input placeholder="..." value={form.secret_key} onChange={e => setForm(f => ({ ...f, secret_key: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Enviada no header <code>X-Webhook-Secret</code></p>
            </div>
            <div className="space-y-2">
              <Label>Eventos</Label>
              {EVENTOS.map(ev => (
                <div key={ev.value} className="flex items-center gap-2">
                  <Checkbox
                    id={ev.value}
                    checked={form.eventos.includes(ev.value)}
                    onCheckedChange={() => toggleEvento(ev.value)}
                  />
                  <label htmlFor={ev.value} className={`text-sm cursor-pointer ${ev.color}`}>{ev.label}</label>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Webhook?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteWebhook} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
