import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Key, Plus, Trash2, Copy, Check, Code, 
  ArrowLeft, RefreshCw, Eye, EyeOff, Loader2 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ApiKey {
  id: string;
  name: string;
  api_key: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

const AdminApiKeys = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'udxaxemoozddkwpitngq';
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/api-clientes`;

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar API Keys",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'ak_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleCreateApiKey = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para a API Key",
        variant: "destructive",
      });
      return;
    }

    try {
      const newApiKey = generateApiKey();
      
      const { error } = await supabase
        .from('api_keys')
        .insert({
          name: formData.name,
          api_key: newApiKey,
          description: formData.description || null,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({
        title: "API Key criada",
        description: "A chave foi gerada com sucesso",
      });

      setFormData({ name: "", description: "" });
      setIsDialogOpen(false);
      fetchApiKeys();
    } catch (error: any) {
      toast({
        title: "Erro ao criar API Key",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setApiKeys(keys => 
        keys.map(key => 
          key.id === id ? { ...key, is_active: !currentStatus } : key
        )
      );

      toast({
        title: currentStatus ? "API Key desativada" : "API Key ativada",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setApiKeys(keys => keys.filter(key => key.id !== id));
      toast({ title: "API Key excluída" });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Copiado!" });
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const maskApiKey = (key: string) => {
    return key.substring(0, 6) + '•'.repeat(20) + key.substring(key.length - 4);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Key className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">API REST</h1>
                <p className="text-sm text-muted-foreground">Gerenciar chaves e documentação</p>
              </div>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Nova API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova API Key</DialogTitle>
                <DialogDescription>
                  Crie uma chave de API para integrar sistemas externos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Integração N8N"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o uso desta API Key..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateApiKey} className="bg-emerald-600 hover:bg-emerald-700">
                  Gerar API Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="keys" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="keys" className="gap-2">
              <Key className="h-4 w-4" />
              Chaves de API
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <Code className="h-4 w-4" />
              Documentação
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="keys">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Chaves de API</CardTitle>
                    <CardDescription>
                      Gerencie as chaves de acesso à API REST
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchApiKeys} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma API Key criada</p>
                    <p className="text-sm">Clique em "Nova API Key" para começar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>API Key</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{key.name}</p>
                              {key.description && (
                                <p className="text-sm text-muted-foreground">{key.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {visibleKeys.has(key.id) ? key.api_key : maskApiKey(key.api_key)}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => toggleKeyVisibility(key.id)}
                              >
                                {visibleKeys.has(key.id) ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyToClipboard(key.api_key, key.id)}
                              >
                                {copiedKey === key.id ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={key.is_active}
                                onCheckedChange={() => handleToggleActive(key.id, key.is_active)}
                              />
                              <Badge variant={key.is_active ? "default" : "secondary"}>
                                {key.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(key.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteApiKey(key.id)}
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
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-6">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Documentação da API REST</CardTitle>
                <CardDescription>
                  Use esta API para integrar com sistemas externos como N8N
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Base URL */}
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted p-3 rounded-lg text-sm font-mono break-all">
                      {baseUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(baseUrl, 'baseurl')}
                    >
                      {copiedKey === 'baseurl' ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Authentication */}
                <div className="space-y-2">
                  <Label>Autenticação</Label>
                  <p className="text-sm text-muted-foreground">
                    Todas as requisições devem incluir o header <code className="bg-muted px-1 rounded">x-api-key</code> com uma chave válida.
                  </p>
                  <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
{`Headers:
x-api-key: sua_api_key_aqui
Content-Type: application/json`}
                  </pre>
                </div>

                {/* Endpoints */}
                <div className="space-y-4">
                  <Label>Endpoints</Label>
                  
                  {/* GET */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500">GET</Badge>
                      <code className="text-sm">/api-clientes</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Lista todos os clientes</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`// Query params opcionais:
?search=termo     // Busca por nome, CPF ou número
?limit=10         // Limite de resultados
?offset=0         // Paginação

// Resposta:
{
  "data": [...],
  "count": 100
}`}
                    </pre>
                  </div>

                  {/* POST */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500">POST</Badge>
                      <code className="text-sm">/api-clientes</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Cria um novo cliente</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`// Body:
{
  "nome": "Nome do Cliente",
  "numero": "11999999999",
  "cpf": "12345678900",
  "email": "email@exemplo.com",
  "produto": "Nome do Produto",
  "data_renovacao": "2024-12-31",
  "valor": 99.90,
  "plano": "Mensal",
  "observacao": "Observação opcional"
}`}
                    </pre>
                  </div>

                  {/* PUT */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-update">PUT</Badge>
                      <code className="text-sm">/api-clientes?id=uuid</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Atualiza um cliente existente</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`// Query param obrigatório:
?id=uuid-do-cliente

// Body (apenas campos a atualizar):
{
  "nome": "Novo Nome",
  "valor": 149.90
}`}
                    </pre>
                  </div>

                  {/* DELETE */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-destructive">DELETE</Badge>
                      <code className="text-sm">/api-clientes?id=uuid</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Remove um cliente</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`// Query param obrigatório:
?id=uuid-do-cliente`}
                    </pre>
                  </div>
                </div>

                {/* N8N Example */}
                <div className="space-y-2">
                  <Label>Exemplo N8N - HTTP Request</Label>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`Método: GET
URL: ${baseUrl}
Headers:
  - x-api-key: sua_api_key_aqui
  - Content-Type: application/json`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminApiKeys;