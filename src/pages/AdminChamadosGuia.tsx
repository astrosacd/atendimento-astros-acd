import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink, Copy, Code, Webhook, Key, Mail } from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';
import { useSiteUrl } from "@/hooks/useSiteUrl";

const AdminChamadosGuia = () => {
  const navigate = useNavigate();
  const siteUrl = useSiteUrl();
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const copyToClipboard = (text: string) => {
    __copyToClipboard(text);
    toast.success('Copiado!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
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
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Guia de Integração</h1>
              <p className="text-sm text-muted-foreground">Sistema de Chamados - API REST</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue="api" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="api">API REST</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="public">URL Pública</TabsTrigger>
            <TabsTrigger value="email">Email SMTP</TabsTrigger>
          </TabsList>

          {/* API REST */}
          <TabsContent value="api" className="space-y-6">
            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  API REST
                </CardTitle>
                <CardDescription>
                  Endpoints para integração programática com o sistema de chamados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Base URL</h3>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg font-mono text-sm">
                    <span className="flex-1 break-all">{baseUrl}/api-chamados</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(`${baseUrl}/api-chamados`)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Autenticação</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Adicione o header <code className="bg-muted px-1 rounded">X-API-Key</code> com sua API key.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Endpoints</h3>
                  
                  {/* GET - Listar todos */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500">GET</Badge>
                      <code className="text-sm font-semibold">Listar todos os chamados</code>
                    </div>
                    <div className="relative">
                      <pre className="p-3 pr-12 bg-zinc-900 text-zinc-100 rounded-lg text-sm overflow-x-auto">
{`curl -X GET "${baseUrl}/api-chamados" \\
  -H "X-API-Key: SUA_API_KEY"`}
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api-chamados" \\\n  -H "X-API-Key: SUA_API_KEY"`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* GET - Buscar por código */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500">GET</Badge>
                      <code className="text-sm font-semibold">Buscar por código</code>
                    </div>
                    <div className="relative">
                      <pre className="p-3 pr-12 bg-zinc-900 text-zinc-100 rounded-lg text-sm overflow-x-auto">
{`curl -X GET "${baseUrl}/api-chamados?codigo=ACD-20241222153045" \\
  -H "X-API-Key: SUA_API_KEY"`}
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api-chamados?codigo=ACD-20241222153045" \\\n  -H "X-API-Key: SUA_API_KEY"`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* GET - Filtrar por status */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500">GET</Badge>
                      <code className="text-sm font-semibold">Filtrar por status</code>
                    </div>
                    <div className="relative">
                      <pre className="p-3 pr-12 bg-zinc-900 text-zinc-100 rounded-lg text-sm overflow-x-auto">
{`curl -X GET "${baseUrl}/api-chamados?status=aberto&limit=50" \\
  -H "X-API-Key: SUA_API_KEY"`}
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api-chamados?status=aberto&limit=50" \\\n  -H "X-API-Key: SUA_API_KEY"`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Status válidos: aberto, em_andamento, aguardando_cliente, resolvido, fechado
                    </p>
                  </div>

                  {/* POST - Criar */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500">POST</Badge>
                      <code className="text-sm font-semibold">Criar novo chamado</code>
                    </div>
                    <div className="relative">
                      <pre className="p-3 pr-12 bg-zinc-900 text-zinc-100 rounded-lg text-sm overflow-x-auto">
{`curl -X POST "${baseUrl}/api-chamados" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nome": "João Silva",
    "email": "joao@email.com",
    "contato": "11999999999",
    "motivo": "Descrição do problema"
  }'`}
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => copyToClipboard(`curl -X POST "${baseUrl}/api-chamados" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "nome": "João Silva",\n    "email": "joao@email.com",\n    "contato": "11999999999",\n    "motivo": "Descrição do problema"\n  }'`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Este endpoint é público (não requer API Key)
                    </p>
                  </div>

                  {/* PUT - Atualizar */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500">PUT</Badge>
                      <code className="text-sm font-semibold">Atualizar chamado</code>
                    </div>
                    <div className="relative">
                      <pre className="p-3 pr-12 bg-zinc-900 text-zinc-100 rounded-lg text-sm overflow-x-auto">
{`curl -X PUT "${baseUrl}/api-chamados?id=UUID_DO_CHAMADO" \\
  -H "X-API-Key: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "em_andamento",
    "prioridade": "alta"
  }'`}
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => copyToClipboard(`curl -X PUT "${baseUrl}/api-chamados?id=UUID_DO_CHAMADO" \\\n  -H "X-API-Key: SUA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "status": "em_andamento",\n    "prioridade": "alta"\n  }'`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requer API Key com permissão de escrita (write)
                    </p>
                  </div>

                  {/* DELETE */}
                  <div className="border border-border/40 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500">DELETE</Badge>
                      <code className="text-sm font-semibold">Excluir chamado</code>
                    </div>
                    <div className="relative">
                      <pre className="p-3 pr-12 bg-zinc-900 text-zinc-100 rounded-lg text-sm overflow-x-auto">
{`curl -X DELETE "${baseUrl}/api-chamados?id=UUID_DO_CHAMADO" \\
  -H "X-API-Key: SUA_API_KEY"`}
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => copyToClipboard(`curl -X DELETE "${baseUrl}/api-chamados?id=UUID_DO_CHAMADO" \\\n  -H "X-API-Key: SUA_API_KEY"`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Requer API Key com permissão de exclusão (delete)
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => navigate('/admin/chamados/api-keys')}>
                    <Key className="h-4 w-4 mr-2" />
                    Gerenciar API Keys
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  Webhooks
                </CardTitle>
                <CardDescription>
                  Receba notificações em tempo real sobre eventos dos chamados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Eventos Disponíveis</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">chamado.criado</Badge>
                      <span className="text-sm text-muted-foreground">Quando um novo chamado é aberto</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">chamado.atualizado</Badge>
                      <span className="text-sm text-muted-foreground">Quando status ou comentário é alterado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">chamado.fechado</Badge>
                      <span className="text-sm text-muted-foreground">Quando o chamado é encerrado</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Payload</h3>
                  <pre className="p-3 bg-muted/50 rounded-lg text-sm overflow-x-auto">
{`{
  "evento": "chamado.criado",
  "timestamp": "2024-12-22T15:30:45.123Z",
  "data": {
    "id": "uuid",
    "codigo": "ACD-20241222153045",
    "nome": "João Silva",
    "email": "joao@email.com",
    "contato": "11999999999",
    "motivo": "Descrição do problema",
    "status": "aberto",
    "prioridade": "media",
    "created_at": "2024-12-22T15:30:45.123Z"
  }
}`}
                  </pre>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Validação de Segurança</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Se configurado, o header <code className="bg-muted px-1 rounded">X-Webhook-Secret</code> será enviado com sua secret key.
                  </p>
                </div>

                <Button onClick={() => navigate('/admin/chamados/webhooks')}>
                  <Webhook className="h-4 w-4 mr-2" />
                  Gerenciar Webhooks
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* URL Pública */}
          <TabsContent value="public" className="space-y-6">
            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-primary" />
                  URL Pública para Clientes
                </CardTitle>
                <CardDescription>
                  Interface web para clientes abrirem e acompanharem chamados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Link principal para enviar aos clientes */}
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    🔗 Link para enviar aos clientes
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Este é o link único e fixo que você deve enviar para seus clientes acessarem o sistema de chamados:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-background rounded-lg font-mono text-sm">
                    <span className="flex-1 break-all">{window.location.origin}/chamados</span>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="shrink-0"
                      onClick={() => {
                        copyToClipboard(`${window.location.origin}/chamados`);
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Link
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open('/chamados', '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir em nova aba
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Funcionalidades</h3>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Abertura de novos chamados</li>
                    <li>Consulta de chamados via código ou email</li>
                    <li>Verificação de identidade por código de 6 dígitos enviado por email</li>
                    <li>Acompanhamento de status em tempo real</li>
                    <li>Adição de comentários públicos</li>
                  </ul>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    ⚠️ Como funciona a Hash de Acesso?
                  </h3>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                      <strong>A hash é FIXA e única por chamado.</strong> Ela é gerada automaticamente quando o chamado é criado e não muda.
                    </p>
                    <p>
                      Cada chamado possui sua própria hash de acesso, que pode ser usada para acessar diretamente aquele chamado específico:
                    </p>
                    <div className="p-2 bg-background rounded font-mono text-xs break-all">
                      {window.location.origin}/chamados?hash=a1b2c3d4e5f6...
                    </div>
                    <p>
                      O cliente pode acessar o chamado através dessa hash sem precisar fazer login ou verificação por email.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Formas de Acesso pelo Cliente</h3>
                  <div className="grid gap-3">
                    <div className="p-3 border border-border/40 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">1</Badge>
                        <span className="font-medium text-sm">Link Geral</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cliente acessa /chamados, abre ou consulta chamados usando código ou email
                      </p>
                    </div>
                    <div className="p-3 border border-border/40 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">2</Badge>
                        <span className="font-medium text-sm">Hash Direta (enviada por email)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ao criar o chamado, o cliente recebe um email com o link direto contendo a hash
                      </p>
                    </div>
                    <div className="p-3 border border-border/40 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">3</Badge>
                        <span className="font-medium text-sm">Código do Chamado</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cliente informa o código (ex: ACD-20241222153045) para consultar
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email SMTP */}
          <TabsContent value="email" className="space-y-6">
            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Configuração de Email SMTP
                </CardTitle>
                <CardDescription>
                  Configuração do Gmail para envio de notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Passo 1: Habilitar Verificação em 2 Etapas</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesse <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Conta Google → Segurança</a> e habilite a verificação em 2 etapas.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Passo 2: Criar Senha de App</h3>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Acesse <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Senhas de App</a></li>
                    <li>Selecione "Outro (nome personalizado)"</li>
                    <li>Digite "Sistema de Chamados" e clique em "Gerar"</li>
                    <li>Copie a senha de 16 caracteres gerada</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Passo 3: Configurar no Sistema</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Acesse as configurações do sistema de chamados e preencha:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Email Gmail: seu-email@gmail.com</li>
                    <li>Senha de App: a senha de 16 caracteres</li>
                    <li>Nome do Remetente: Nome que aparecerá nos emails</li>
                  </ul>
                </div>

                <Button onClick={() => navigate('/admin/chamados/config')}>
                  <Mail className="h-4 w-4 mr-2" />
                  Ir para Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminChamadosGuia;
