import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, RefreshCw, Webhook, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface WebhookConfig {
  id: string;
  nome: string;
  url: string;
  secret_key: string | null;
  eventos: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export default function ConsultaNumerosWebhooks() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    url: '',
    secret_key: '',
    eventos: [] as string[],
  });

  const AVAILABLE_EVENTS = [
    { key: 'cadastro', label: t('numberQueryWebhooks.events.cadastro') },
    { key: 'consulta', label: t('numberQueryWebhooks.events.consulta') },
    { key: 'atualizacao_status', label: t('numberQueryWebhooks.events.atualizacao_status') },
    { key: 'atualizacao_obs', label: t('numberQueryWebhooks.events.atualizacao_obs') },
    { key: 'atualizacao_status_obs', label: t('numberQueryWebhooks.events.atualizacao_status_obs') },
  ];

  // Fetch webhooks
  const { data: webhooks = [], isLoading } = useQuery<WebhookConfig[]>({
    queryKey: ['consulta-numeros-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create/Update webhook
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingWebhook) {
        const { error } = await supabase
          .from('consulta_numeros_webhooks')
          .update({
            nome: formData.nome,
            url: formData.url,
            secret_key: formData.secret_key || null,
            eventos: formData.eventos,
          })
          .eq('id', editingWebhook.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('consulta_numeros_webhooks')
          .insert({
            nome: formData.nome,
            url: formData.url,
            secret_key: formData.secret_key || null,
            eventos: formData.eventos,
            created_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-webhooks'] });
      toast({ title: editingWebhook ? t('numberQueryWebhooks.toast.updated') : t('numberQueryWebhooks.toast.created') });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: t('numberQueryWebhooks.toast.saveError'), description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('consulta_numeros_webhooks')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-webhooks'] });
      toast({ title: t('numberQueryWebhooks.toast.statusUpdated') });
    },
  });

  // Delete webhook
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consulta_numeros_webhooks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-webhooks'] });
      toast({ title: t('numberQueryWebhooks.toast.deleted') });
    },
  });

  const handleSave = () => {
    if (!formData.nome.trim() || !formData.url.trim()) {
      toast({ title: t('numberQueryWebhooks.validation.nameUrlRequired'), variant: 'destructive' });
      return;
    }
    if (formData.eventos.length === 0) {
      toast({ title: t('numberQueryWebhooks.validation.selectAtLeastOneEvent'), variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const handleEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setFormData({
      nome: webhook.nome,
      url: webhook.url,
      secret_key: webhook.secret_key || '',
      eventos: webhook.eventos,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nome: '', url: '', secret_key: '', eventos: [] });
    setEditingWebhook(null);
    setDialogOpen(false);
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      eventos: prev.eventos.includes(event)
        ? prev.eventos.filter(e => e !== event)
        : [...prev.eventos, event],
    }));
  };

  const generateSecret = () => {
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
    setFormData(prev => ({ ...prev, secret_key: secret }));
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => window.location.href = '/admin/consulta-numeros'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('numberQueryWebhooks.title')}</h1>
              <p className="text-muted-foreground">{t('numberQueryWebhooks.subtitle')}</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('numberQueryWebhooks.newWebhook')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingWebhook ? t('numberQueryWebhooks.editWebhook') : t('numberQueryWebhooks.createWebhook')}</DialogTitle>
                <DialogDescription>
                  {t('numberQueryWebhooks.dialogDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">{t('numberQueryWebhooks.form.name')} *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder={t('numberQueryWebhooks.form.namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">{t('numberQueryWebhooks.form.url')} *</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder={t('numberQueryWebhooks.form.urlPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret">{t('numberQueryWebhooks.form.secretKey')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secret"
                      value={formData.secret_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, secret_key: e.target.value }))}
                      placeholder={t('numberQueryWebhooks.form.secretPlaceholder')}
                    />
                    <Button variant="outline" onClick={generateSecret} type="button">
                      {t('numberQueryWebhooks.form.generate')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('numberQueryWebhooks.form.secretHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t('numberQueryWebhooks.form.events')} *</Label>
                  <div className="space-y-2">
                    {AVAILABLE_EVENTS.map((event) => (
                      <div key={event.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={event.key}
                          checked={formData.eventos.includes(event.key)}
                          onCheckedChange={() => toggleEvent(event.key)}
                        />
                        <label htmlFor={event.key} className="text-sm">{event.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>{t('common.cancel')}</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? t('common.loading') : t('common.save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              {t('numberQueryWebhooks.configuredWebhooks')}
            </CardTitle>
            <CardDescription>
              {t('numberQueryWebhooks.configuredCount', { count: webhooks.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('numberQueryWebhooks.emptyState')}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>{t('numberQueryWebhooks.table.events')}</TableHead>
                      <TableHead>{t('numberQueryWebhooks.table.lastTrigger')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="w-[120px]">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">{webhook.nome}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate block max-w-[200px]">
                            {webhook.url}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {webhook.eventos.map((e) => (
                              <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {webhook.last_triggered_at
                            ? format(new Date(webhook.last_triggered_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : t('numberQueryWebhooks.never')}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={(checked) => toggleMutation.mutate({ id: webhook.id, is_active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(webhook)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('numberQueryWebhooks.deleteTitle')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('numberQueryWebhooks.deleteDescription', { name: webhook.nome })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(webhook.id)}>
                                    {t('common.delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
      </div>
    </DashboardLayout>
  );
}

