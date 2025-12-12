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

interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret_key: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { id: 'cliente.created', label: 'Cliente Criado' },
  { id: 'cliente.updated', label: 'Cliente Atualizado' },
  { id: 'cliente.deleted', label: 'Cliente Excluído' },
];

export default function AdminWebhooks() {
  const navigate = useNavigate();
  const { user, isAdmin, isApproved } = useAuth();
  const { toast } = useToast();

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
      toast({ title: 'Erro ao carregar webhooks', description: error.message, variant: 'destructive' });
    } else {
      setWebhooks(data || []);
    }
    setIsLoading(false);
  };

  const createWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
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
      toast({ title: 'Erro ao criar webhook', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Webhook criado com sucesso!' });
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
      toast({ title: 'Erro ao atualizar webhook', variant: 'destructive' });
    } else {
      loadWebhooks();
    }
  };

  const deleteWebhook = async (id: string) => {
    const { error } = await supabase.from('webhooks').delete().eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir webhook', variant: 'destructive' });
    } else {
      toast({ title: 'Webhook excluído!' });
      loadWebhooks();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
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
            <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
            <p className="text-muted-foreground">
              Receba notificações em tempo real quando clientes são criados, atualizados ou excluídos
            </p>
          </div>
        </div>

        {/* Webhooks Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                Webhooks Configurados
              </CardTitle>
              <CardDescription>
                Configure endpoints para receber eventos via n8n ou outros sistemas
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Webhook</DialogTitle>
                  <DialogDescription>
                    Configure um webhook para receber eventos de alteração de clientes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      placeholder="Ex: n8n Production"
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">URL do Webhook</Label>
                    <Input
                      id="url"
                      placeholder="https://n8n.example.com/webhook/..."
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Eventos</Label>
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
                    <Label htmlFor="secret">Chave Secreta (opcional)</Label>
                    <Input
                      id="secret"
                      placeholder="Para validação de assinatura"
                      value={newWebhook.secret_key}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, secret_key: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={createWebhook}>Criar Webhook</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum webhook configurado</p>
                <p className="text-sm">Crie um webhook para começar a receber eventos</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Eventos</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
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
            <CardTitle className="text-base">Formato do Payload</CardTitle>
            <CardDescription>Exemplo do payload enviado para seu webhook quando um evento ocorre</CardDescription>
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