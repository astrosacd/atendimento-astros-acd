import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Copy, Trash2, RefreshCw, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApiKey {
  id: string;
  nome: string;
  api_key: string;
  descricao: string | null;
  is_active: boolean;
  permissions: string[];
  last_used_at: string | null;
  created_at: string;
}

const AVAILABLE_PERMISSIONS = [
  { key: 'query', label: 'Consultar números' },
  { key: 'update_status', label: 'Atualizar status' },
  { key: 'update_obs', label: 'Atualizar observações' },
  { key: 'view_history', label: 'Visualizar histórico' },
];

export default function ConsultaNumerosApiKeys() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [generatedKey, setGeneratedKey] = useState('');

  // Fetch API keys
  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['consulta-numeros-api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create API key
  const createMutation = useMutation({
    mutationFn: async () => {
      const apiKey = `cn_${crypto.randomUUID().replace(/-/g, '')}`;
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('consulta_numeros_api_keys')
        .insert({
          nome: newKeyName,
          api_key: apiKey,
          descricao: newKeyDescription || null,
          permissions: newKeyPermissions,
          created_by: user?.id,
        });
      
      if (error) throw error;
      return apiKey;
    },
    onSuccess: (key) => {
      setGeneratedKey(key);
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-api-keys'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar chave', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('consulta_numeros_api_keys')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-api-keys'] });
      toast({ title: 'Status atualizado!' });
    },
  });

  // Delete API key
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consulta_numeros_api_keys')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-api-keys'] });
      toast({ title: 'Chave excluída!' });
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    createMutation.mutate();
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: 'Chave copiada!' });
  };

  const resetCreateForm = () => {
    setNewKeyName('');
    setNewKeyDescription('');
    setNewKeyPermissions([]);
    setGeneratedKey('');
    setCreateDialogOpen(false);
  };

  const togglePermission = (perm: string) => {
    setNewKeyPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => window.location.href = '/admin/consulta-numeros'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Chaves de API</h1>
              <p className="text-muted-foreground">Gerencie as chaves de acesso à API</p>
            </div>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Chave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Chave de API</DialogTitle>
                <DialogDescription>
                  Gere uma nova chave para acesso programático à API
                </DialogDescription>
              </DialogHeader>
              
              {generatedKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm font-medium text-green-500 mb-2">Chave criada com sucesso!</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Copie esta chave agora. Ela não será exibida novamente.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                        {generatedKey}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => handleCopyKey(generatedKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button onClick={resetCreateForm} className="w-full">Fechar</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Ex: Integração N8N"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={newKeyDescription}
                        onChange={(e) => setNewKeyDescription(e.target.value)}
                        placeholder="Descreva o propósito desta chave..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Permissões</Label>
                      <div className="space-y-2">
                        {AVAILABLE_PERMISSIONS.map((perm) => (
                          <div key={perm.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={perm.key}
                              checked={newKeyPermissions.includes(perm.key)}
                              onCheckedChange={() => togglePermission(perm.key)}
                            />
                            <label htmlFor={perm.key} className="text-sm">{perm.label}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Gerando...' : 'Gerar Chave'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Chaves Ativas
            </CardTitle>
            <CardDescription>
              {apiKeys.length} chave(s) cadastrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma chave de API cadastrada.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Chave</TableHead>
                      <TableHead>Permissões</TableHead>
                      <TableHead>Último Uso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{key.nome}</p>
                            {key.descricao && (
                              <p className="text-xs text-muted-foreground">{key.descricao}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {key.api_key.substring(0, 12)}...
                            </code>
                            <Button variant="ghost" size="sm" onClick={() => handleCopyKey(key.api_key)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {key.permissions.map((p) => (
                              <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {key.last_used_at 
                            ? format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : 'Nunca'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={key.is_active}
                            onCheckedChange={(checked) => toggleMutation.mutate({ id: key.id, is_active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir chave de API?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A chave "{key.nome}" será permanentemente excluída.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(key.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
