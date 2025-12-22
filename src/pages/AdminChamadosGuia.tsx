import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink, Copy, Code, Webhook, Key, Mail } from "lucide-react";
import { toast } from "sonner";

const AdminChamadosGuia = () => {
  const navigate = useNavigate();
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
          <TabsList className="grid w-full grid-cols-4">
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
                    <span>{baseUrl}/api-chamados</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(`${baseUrl}/api-chamados`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Autenticação</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Adicione o header <code className="bg-muted px-1 rounded">X-API-Key</code> com sua API key.
                  </p>
                  <pre className="p-3 bg-muted/50 rounded-lg text-sm overflow-x-auto">
{`curl -X GET "${baseUrl}/api-chamados" \\
  -H "X-API-Key: acd_sua_api_key_aqui"`}
                  </pre>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Endpoints</h3>
                  
                  {/* GET - Listar */}
                  <div className="border border-border/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-emerald-500">GET</Badge>
                      <code className="text-sm">/api-chamados</code>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Lista todos os chamados. Filtros opcionais:</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li><code>?id=UUID</code> - Buscar por ID</li>
                      <li><code>?codigo=ACD-...</code> - Buscar por código</li>
                      <li><code>?email=email@exemplo.com</code> - Buscar por email</li>
                      <li><code>?status=aberto</code> - Filtrar por status</li>
                      <li><code>?limit=50&offset=0</code> - Paginação</li>
                    </ul>
                  </div>

                  {/* POST - Criar */}
                  <div className="border border-border/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-500">POST</Badge>
                      <code className="text-sm">/api-chamados</code>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Criar novo chamado (acesso público):</p>
                    <pre className="p-3 bg-muted/50 rounded-lg text-sm overflow-x-auto">
{`{
  "nome": "João Silva",
  "email": "joao@email.com",
  "contato": "11999999999",
  "motivo": "Descrição do problema"
}`}
                    </pre>
                  </div>

                  {/* PUT - Atualizar */}
                  <div className="border border-border/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-500">PUT</Badge>
                      <code className="text-sm">/api-chamados?id=UUID</code>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Atualizar chamado (requer permissão write):</p>
                    <pre className="p-3 bg-muted/50 rounded-lg text-sm overflow-x-auto">
{`{
  "status": "em_andamento",
  "prioridade": "alta"
}`}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      Status válidos: aberto, em_andamento, aguardando_cliente, resolvido, fechado
                    </p>
                  </div>

                  {/* DELETE */}
                  <div className="border border-border/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-red-500">DELETE</Badge>
                      <code className="text-sm">/api-chamados?id=UUID</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Excluir chamado (requer permissão delete)</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Código do Chamado</h3>
                  <p className="text-sm text-muted-foreground">
                    Formato: <code className="bg-muted px-1 rounded">ACD-YYYYMMDDHHMMSSXX</code>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Exemplo: <code className="bg-muted px-1 rounded">ACD-2024122215304512</code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerado automaticamente com timezone de Brasília (America/Sao_Paulo)
                  </p>
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
                <div>
                  <h3 className="font-semibold mb-2">URL de Acesso</h3>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg font-mono text-sm">
                    <span>{window.location.origin}/chamados</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(`${window.location.origin}/chamados`)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open('/chamados', '_blank')}>
                      <ExternalLink className="h-3 w-3" />
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

                <div>
                  <h3 className="font-semibold mb-2">Acesso Direto ao Chamado</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Cada chamado possui um hash único de acesso:
                  </p>
                  <div className="p-3 bg-muted/50 rounded-lg font-mono text-sm">
                    {window.location.origin}/chamados/acompanhar?hash=HASH_DO_CHAMADO
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
