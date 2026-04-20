import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Webhook, Plus, Trash2, Eye, EyeOff, RefreshCw, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';

const EVENTOS = [
  { value: 'chamado.criado', label: 'Chamado Criado' },
  { value: 'chamado.atualizado', label: 'Chamado Atualizado' },
  { value: 'chamado.fechado', label: 'Chamado Fechado' },
];

interface WebhookForm {
  nome: string;
  url: string;
  secret_key: string;
  eventos: string[];
  is_active: boolean;
}

const AdminChamadosWebhooks = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<WebhookForm>({
    nome: '',
    url: '',
    secret_key: '',
    eventos: [],
    is_active: true,
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['chamados-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (webhook: WebhookForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('chamados_webhooks')
        .insert({
          ...webhook,
          created_by: user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-webhooks'] });
      setIsDialogOpen(false);
      setForm({ nome: '', url: '', secret_key: '', eventos: [], is_active: true });
      toast.success('Webhook criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating webhook:', error);
      toast.error('Erro ao criar webhook');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('chamados_webhooks')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-webhooks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chamados_webhooks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-webhooks'] });
      toast.success('Webhook excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir webhook');
    },
  });

  const generateSecretKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    setForm(prev => ({ ...prev, secret_key: secret }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin/chamados')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Webhook className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Webhooks</h1>
                <p className="text-sm text-muted-foreground">Sistema de Chamados</p>
              </div>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Webhook</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Meu Webhook"
                  />
                </div>
                <div>
                  <Label>URL</Label>
                  <Input
                    value={form.url}
                    onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://api.exemplo.com/webhook"
                  />
                </div>
                <div>
                  <Label>Secret Key (opcional)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.secret_key}
                      onChange={(e) => setForm(prev => ({ ...prev, secret_key: e.target.value }))}
                      placeholder="Chave secreta para validação"
                    />
                    <Button type="button" variant="outline" onClick={generateSecretKey}>
                      Gerar
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Eventos</Label>
                  <div className="space-y-2 mt-2">
                    {EVENTOS.map(evento => (
                      <label key={evento.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={form.eventos.includes(evento.value)}
                          onCheckedChange={(checked) => {
                            setForm(prev => ({
                              ...prev,
                              eventos: checked
                                ? [...prev.eventos, evento.value]
                                : prev.eventos.filter(e => e !== evento.value),
                            }));
                          }}
                        />
                        <span className="text-sm">{evento.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.nome || !form.url || form.eventos.length === 0 || createMutation.isPending}
                >
                  Criar Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle>Webhooks Configurados</CardTitle>
            <CardDescription>
              Receba notificações em tempo real quando eventos ocorrerem
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : webhooks?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum webhook configurado
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Eventos</TableHead>
                      <TableHead>Secret</TableHead>
                      <TableHead>Último Disparo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks?.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">{webhook.nome}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">
                          {webhook.url}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {webhook.eventos?.map((e: string) => (
                              <Badge key={e} variant="secondary" className="text-xs">
                                {e.split('.')[1]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {webhook.secret_key ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs">
                                {showSecrets[webhook.id] ? webhook.secret_key.slice(0, 20) + '...' : '••••••••'}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setShowSecrets(prev => ({ ...prev, [webhook.id]: !prev[webhook.id] }))}
                              >
                                {showSecrets[webhook.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  __copyToClipboard(webhook.secret_key);
                                  toast.success('Secret copiado!');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {webhook.last_triggered_at 
                            ? format(new Date(webhook.last_triggered_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: webhook.id, is_active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminChamadosWebhooks;
