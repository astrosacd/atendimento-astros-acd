import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

export function InstancesManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    instance_name: '',
    api_url: '',
    api_key: '',
  });

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ['divulgador-instances'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_instances')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      const { error } = await (supabase as any)
        .from('divulgador_instances')
        .insert([formData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
      toast.success('Instância adicionada!');
      setIsDialogOpen(false);
      setForm({ instance_name: '', api_url: '', api_key: '' });
    },
    onError: (error: any) => toast.error('Erro: ' + error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('divulgador_instances')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
      toast.success('Instância atualizada!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('divulgador_instances')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
      toast.success('Instância removida!');
    },
  });

  const testConnection = async (instance: any) => {
    setTestingId(instance.id);
    try {
      const response = await fetch(`${instance.api_url}/instance/connectionState/${instance.instance_name}`, {
        headers: { 'apikey': instance.api_key },
      });

      if (response.ok) {
        const data = await response.json();
        const state = data?.instance?.state || data?.state;
        if (state === 'open') {
          toast.success(`${instance.instance_name}: Conectado!`);
          await (supabase as any)
            .from('divulgador_instances')
            .update({ is_connected: true, last_connected_at: new Date().toISOString() })
            .eq('id', instance.id);
          queryClient.invalidateQueries({ queryKey: ['divulgador-instances'] });
        } else {
          toast.warning(`${instance.instance_name}: ${state || 'desconhecido'}`);
        }
      } else {
        toast.error('Falha na conexão');
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Card className="border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-orange-500" />
              Múltiplas Instâncias WhatsApp
            </CardTitle>
            <CardDescription>Configure várias instâncias para diferentes campanhas</CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nova Instância
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : instances.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma instância configurada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>API URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map((inst: any) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.instance_name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{inst.api_url}</TableCell>
                  <TableCell>
                    <Badge variant={inst.is_connected ? "default" : "secondary"} className="gap-1">
                      {inst.is_connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {inst.is_connected ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={inst.is_active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: inst.id, is_active: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => testConnection(inst)}
                        disabled={testingId === inst.id}
                      >
                        {testingId === inst.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(inst.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instância WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                value={form.instance_name}
                onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
                placeholder="divulgador-01"
              />
            </div>
            <div className="space-y-2">
              <Label>API URL</Label>
              <Input
                value={form.api_url}
                onChange={(e) => setForm({ ...form, api_url: e.target.value })}
                placeholder="https://api.evolution.com"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="Sua API Key"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.instance_name || !form.api_url || !form.api_key}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
