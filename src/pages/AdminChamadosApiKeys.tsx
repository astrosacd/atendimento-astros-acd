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
import { ArrowLeft, Key, Plus, Trash2, Eye, EyeOff, RefreshCw, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PERMISSIONS = [
  { value: 'read', label: 'Leitura', description: 'Listar e consultar chamados' },
  { value: 'write', label: 'Escrita', description: 'Atualizar status e adicionar comentários' },
  { value: 'delete', label: 'Exclusão', description: 'Excluir chamados' },
];

interface ApiKeyForm {
  nome: string;
  descricao: string;
  permissions: string[];
  is_active: boolean;
}

const AdminChamadosApiKeys = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [form, setForm] = useState<ApiKeyForm>({
    nome: '',
    descricao: '',
    permissions: ['read'],
    is_active: true,
  });

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['chamados-api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const generateApiKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return 'acd_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const createMutation = useMutation({
    mutationFn: async (data: ApiKeyForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      const apiKey = generateApiKey();
      
      const { error } = await supabase
        .from('chamados_api_keys')
        .insert({
          ...data,
          api_key: apiKey,
          created_by: user?.id,
        });
      
      if (error) throw error;
      return apiKey;
    },
    onSuccess: (apiKey) => {
      queryClient.invalidateQueries({ queryKey: ['chamados-api-keys'] });
      setNewApiKey(apiKey);
      setForm({ nome: '', descricao: '', permissions: ['read'], is_active: true });
    },
    onError: (error) => {
      console.error('Error creating API key:', error);
      toast.error('Erro ao criar API key');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('chamados_api_keys')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-api-keys'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chamados_api_keys')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados-api-keys'] });
      toast.success('API key excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir API key');
    },
  });

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
                <Key className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">API Keys</h1>
                <p className="text-sm text-muted-foreground">Sistema de Chamados</p>
              </div>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setNewApiKey(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{newApiKey ? 'API Key Criada!' : 'Criar Nova API Key'}</DialogTitle>
              </DialogHeader>
              {newApiKey ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-600 mb-2">
                      ⚠️ Copie esta chave agora! Ela não será exibida novamente.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input value={newApiKey} readOnly className="font-mono text-xs" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(newApiKey);
                          toast.success('API key copiada!');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => {
                    setIsDialogOpen(false);
                    setNewApiKey(null);
                  }}>
                    Fechar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Integração Principal"
                    />
                  </div>
                  <div>
                    <Label>Descrição (opcional)</Label>
                    <Input
                      value={form.descricao}
                      onChange={(e) => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Usada para integração com sistema X"
                    />
                  </div>
                  <div>
                    <Label>Permissões</Label>
                    <div className="space-y-2 mt-2">
                      {PERMISSIONS.map(perm => (
                        <label key={perm.value} className="flex items-start gap-2 cursor-pointer">
                          <Checkbox
                            checked={form.permissions.includes(perm.value)}
                            onCheckedChange={(checked) => {
                              setForm(prev => ({
                                ...prev,
                                permissions: checked
                                  ? [...prev.permissions, perm.value]
                                  : prev.permissions.filter(p => p !== perm.value),
                              }));
                            }}
                          />
                          <div>
                            <span className="text-sm font-medium">{perm.label}</span>
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => createMutation.mutate(form)}
                    disabled={!form.nome || form.permissions.length === 0 || createMutation.isPending}
                  >
                    Criar API Key
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle>API Keys Ativas</CardTitle>
            <CardDescription>
              Gerencie as chaves de API para acesso programático
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma API key configurada
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Permissões</TableHead>
                      <TableHead>Último Uso</TableHead>
                      <TableHead>Ativa</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys?.map((key) => (
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
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">
                              {showKeys[key.id] ? key.api_key : key.api_key.slice(0, 12) + '...'}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setShowKeys(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                            >
                              {showKeys[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                navigator.clipboard.writeText(key.api_key);
                                toast.success('API key copiada!');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {key.permissions?.map((p: string) => (
                              <Badge key={p} variant="secondary" className="text-xs">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {key.last_used_at 
                            ? format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : 'Nunca'
                          }
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={key.is_active}
                            onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: key.id, is_active: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(key.id)}
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

export default AdminChamadosApiKeys;
