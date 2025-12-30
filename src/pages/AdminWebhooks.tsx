import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Webhook, Copy, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret_key: string | null;
  created_at: string;
}

export default function AdminWebhooks() {
  const navigate = useNavigate();
  const { user, isAdmin, isApproved } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret_key: '',
  });

  useEffect(() => {
    if (!user || !isApproved) {
      navigate('/auth');
      return;
    }
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    loadWebhooks();
  }, [user, isAdmin, isApproved, navigate]);

  const loadWebhooks = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: t('webhooks.errorLoading'), description: error.message, variant: 'destructive' });
    } else {
      setWebhooks(data || []);
    }
    setIsLoading(false);
  };

  const EVENT_TYPES = [
    { id: 'cliente.created', label: t('webhooks.eventTypes.clienteCreated') },
    { id: 'cliente.updated', label: t('webhooks.eventTypes.clienteUpdated') },
    { id: 'cliente.deleted', label: t('webhooks.eventTypes.clienteDeleted') },
    { id: 'licenca.created', label: t('webhooks.eventTypes.licencaCreated') },
    { id: 'licenca.deleted', label: t('webhooks.eventTypes.licencaDeleted') },
  ];

  const createWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast({ title: t('webhooks.fillAllFields'), variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('webhooks').insert({
      name: newWebhook.name,
      url: newWebhook.url,
      events: newWebhook.events,
      secret_key: newWebhook.secret_key || null,
      created_by: user?.id,
    });

    if (error) {
      toast({ title: t('webhooks.errorCreating'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('webhooks.webhookCreated') });
      setDialogOpen(false);
      setNewWebhook({ name: '', url: '', events: [], secret_key: '' });
      loadWebhooks();
    }
  };

  const toggleWebhookActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('webhooks')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast({ title: t('webhooks.errorUpdating'), variant: 'destructive' });
    } else {
      loadWebhooks();
    }
  };

  const deleteWebhook = async (id: string) => {
    const { error } = await supabase.from('webhooks').delete().eq('id', id);

    if (error) {
      toast({ title: t('webhooks.errorDeleting'), variant: 'destructive' });
    } else {
      toast({ title: t('webhooks.webhookDeleted') });
      loadWebhooks();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('webhooks.copied') });
  };

  const toggleEventSelection = (eventId: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('webhooks.title')}</h1>
            <p className="text-muted-foreground">
              {t('webhooks.subtitle')}
            </p>
          </div>
        </div>

        {/* Webhooks Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                {t('webhooks.configured')}
              </CardTitle>
              <CardDescription>
                {t('webhooks.configuredDesc')}
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('webhooks.newWebhook')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('webhooks.createWebhook')}</DialogTitle>
                  <DialogDescription>
                    {t('webhooks.dialogDescription')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('webhooks.name')}</Label>
                    <Input
                      id="name"
                      placeholder={t('webhooks.namePlaceholder')}
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">{t('webhooks.url')}</Label>
                    <Input
                      id="url"
                      placeholder={t('webhooks.urlPlaceholder')}
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('webhooks.events')}</Label>
                    <div className="space-y-2">
                      {EVENT_TYPES.map((event) => (
                        <div key={event.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={event.id}
                            checked={newWebhook.events.includes(event.id)}
                            onCheckedChange={() => toggleEventSelection(event.id)}
                          />
                          <Label htmlFor={event.id} className="font-normal cursor-pointer">
                            {event.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret">{t('webhooks.secretKey')}</Label>
                    <Input
                      id="secret"
                      placeholder={t('webhooks.secretPlaceholder')}
                      value={newWebhook.secret_key}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, secret_key: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    {t('webhooks.cancel')}
                  </Button>
                  <Button onClick={createWebhook}>{t('webhooks.create')}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t('webhooks.loading')}</div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{t('webhooks.noWebhooks')}</p>
                <p className="text-sm">{t('webhooks.noWebhooksDesc')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('webhooks.tableHeaders.name')}</TableHead>
                    <TableHead>{t('webhooks.tableHeaders.url')}</TableHead>
                    <TableHead>{t('webhooks.tableHeaders.events')}</TableHead>
                    <TableHead>{t('webhooks.tableHeaders.key')}</TableHead>
                    <TableHead>{t('webhooks.tableHeaders.active')}</TableHead>
                    <TableHead className="w-[100px]">{t('webhooks.tableHeaders.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                            {webhook.url}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(webhook.url)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {EVENT_TYPES.find(e => e.id === event)?.label || event}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {webhook.secret_key ? (
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-muted px-2 py-1 rounded max-w-[120px] truncate">
                              {showSecrets[webhook.id] ? webhook.secret_key : '••••••••'}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setShowSecrets(prev => ({ ...prev, [webhook.id]: !prev[webhook.id] }))}
                            >
                              {showSecrets[webhook.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={webhook.is_active}
                          onCheckedChange={() => toggleWebhookActive(webhook.id, webhook.is_active)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Webhook Payload Example */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('webhooks.payloadFormat')}</CardTitle>
            <CardDescription>{t('webhooks.payloadDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "event": "cliente.created",
  "timestamp": "2024-12-12T14:30:00Z",
  "data": {
    "cliente": {
      "id": "uuid",
      "nome": "Nome do Cliente",
      "email": "email@example.com",
      "numero": "11999999999",
      "cpf": "00000000000",
      "produto": "Produto X",
      "plano": "Premium",
      "valor": 99.90,
      "data_renovacao": "2025-01-12"
    },
    "usuario": {
      "id": "uuid",
      "email": "admin@example.com",
      "name": "Nome do Admin"
    }
  }
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}