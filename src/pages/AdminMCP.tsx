import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, RefreshCw, Copy, Check, Eye, EyeOff, Loader2,
  Database, Shield, Settings, Server
} from "lucide-react";
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';

interface McpTool {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  tool_type: string;
  configuration: any;
}

const AdminMCP = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tools, setTools] = useState<McpTool[]>([]);
  const [apiKey, setApiKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const mcpUrl = `${supabaseUrl}/functions/v1/mcp-server`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [toolsRes, configRes] = await Promise.all([
        supabase.from('mcp_tools').select('*').order('name'),
        supabase.from('mcp_config').select('*').eq('config_key', 'mcp_api_key').single()
      ]);

      if (toolsRes.error) throw toolsRes.error;
      if (configRes.error) throw configRes.error;

      setTools(toolsRes.data || []);
      setApiKey(configRes.data?.config_value || "");
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTool = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('mcp_tools')
        .update({ enabled: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setTools(prev => prev.map(tool => 
        tool.id === id ? { ...tool, enabled: !currentStatus } : tool
      ));

      toast({
        title: !currentStatus ? "Ferramenta habilitada" : "Ferramenta desabilitada",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar ferramenta",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const rotateApiKey = async () => {
    if (!confirm("Isso invalidará a chave atual do OpenClaw. Deseja continuar?")) return;
    
    setIsRefreshing(true);
    try {
      const newKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase
        .from('mcp_config')
        .update({ config_value: newKey })
        .eq('config_key', 'mcp_api_key');

      if (error) throw error;

      setApiKey(newKey);
      toast({
        title: "Chave de API rotacionada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao rotacionar chave",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    __copyToClipboard(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: "Copiado!" });
  };

  const syncTablesAsTools = async () => {
    if (!confirm("Deseja listar as principais tabelas do sistema como ferramentas?")) return;
    
    setIsRefreshing(true);
    try {
        // Query available tables (simplified for now)
        const tables = ['clientes', 'billing_logs', 'profiles', 'audit_logs', 'chat_messages'];
        
        for (const table of tables) {
            await supabase.from('mcp_tools').upsert({
                name: `read_${table}`,
                description: `Acesso de leitura para a tabela ${table}`,
                tool_type: 'table_access',
                enabled: false,
                configuration: { table, operations: ['select'] }
            }, { onConflict: 'name' });
        }
        
        fetchData();
        toast({ title: "Tabelas sincronizadas como ferramentas!" });
    } catch (error: any) {
        toast({
            title: "Erro ao sincronizar tabelas",
            description: error.message,
            variant: "destructive",
        });
    } finally {
        setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Configuração MCP (OpenClaw)
              </h1>
              <p className="text-sm text-muted-foreground">Gerencie o acesso do agente de IA ao seu sistema</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-emerald-500" />
              Credenciais de Conexão
            </CardTitle>
            <CardDescription>
              Use estes dados no OpenClaw para estabelecer a conexão via MCP.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>URL do Servidor MCP</Label>
                <div className="flex gap-2">
                  <Input readOnly value={mcpUrl} className="font-mono text-xs bg-muted" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(mcpUrl, 'url')}>
                    {copiedKey === 'url' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Chave de API (x-api-key)</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    type={showApiKey ? "text" : "password"} 
                    value={apiKey} 
                    className="font-mono text-xs bg-muted" 
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey, 'key')}>
                    {copiedKey === 'key' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={rotateApiKey} disabled={isRefreshing}>
                    Rotacionar Chave
                </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tools Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-blue-500" />
                Gerenciar Ferramentas
              </CardTitle>
              <CardDescription>
                Habilite ou desabilite o que o OpenClaw pode acessar.
              </CardDescription>
            </div>
            <Button onClick={syncTablesAsTools} disabled={isRefreshing}>
                <Database className="h-4 w-4 mr-2" />
                Sincronizar Tabelas
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ferramenta</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhuma ferramenta configurada. Clique em "Sincronizar Tabelas" para começar.
                        </TableCell>
                    </TableRow>
                ) : tools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-medium">{tool.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tool.description}</TableCell>
                    <TableCell>
                        <Badge variant="secondary">{tool.tool_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <Switch 
                          checked={tool.enabled} 
                          onCheckedChange={() => handleToggleTool(tool.id, tool.enabled)} 
                        />
                        <Badge variant={tool.enabled ? "default" : "secondary"}>
                          {tool.enabled ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Sync Confirmation Dialog */}
        <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sincronizar Tabelas</DialogTitle>
              <DialogDescription>
                Deseja listar as principais tabelas do sistema como ferramentas para o OpenClaw? 
                Isso adicionará novas opções na lista abaixo (inicialmente desativadas).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>Cancelar</Button>
              <Button onClick={syncTablesAsTools}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rotate Key Confirmation Dialog */}
        <Dialog open={isRotateDialogOpen} onOpenChange={setIsRotateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rotacionar Chave de API</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja gerar uma nova chave? A conexão atual do OpenClaw será interrompida até que você atualize a chave lá.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRotateDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={rotateApiKey}>Rotacionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminMCP;
