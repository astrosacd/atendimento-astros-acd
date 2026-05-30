import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, BookOpen, Database, Key, Webhook, Shield, Code, CheckCircle2, AlertCircle, Info, Copy, ExternalLink, Bell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';

export default function ConsultaNumerosGuia() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const copyToClipboard = (text: string) => {
    __copyToClipboard(text);
    toast({ title: 'Copiado!' });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => window.location.href = '/admin/consulta-numeros'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Documentação do Módulo</h1>
            <p className="text-muted-foreground">Guia completo do Consulta de Números</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Configuração</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Permissões</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">API REST</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="examples" className="gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Exemplos</span>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Lembretes</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  O que é o Consulta de Números?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  O módulo <strong className="text-foreground">Consulta de Números</strong> permite consultar 
                  e atualizar registros armazenados no Baserow, uma plataforma de banco de dados no-code. 
                  É ideal para gerenciar números de WhatsApp, telefones ou qualquer dado tabular.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Consulta Rápida
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Busque números por texto parcial ou completo com filtros por status.
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Atualização em Tempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Altere status e observações diretamente, com sincronização automática no Baserow.
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Auditoria Completa
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Histórico detalhado de todas as ações, consultas e atualizações realizadas.
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    API REST
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Integre com sistemas externos via API documentada com chaves de acesso.
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Webhooks
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Receba notificações automáticas quando ações forem realizadas no módulo.
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Permissões Granulares
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Controle quem pode consultar, atualizar e gerenciar cada funcionalidade.
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Como Funciona</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                    <span className="font-bold text-primary">1</span>
                    <span>Solicitação</span>
                  </div>
                  <div className="hidden md:block text-muted-foreground">→</div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                    <span className="font-bold text-primary">2</span>
                    <span>Baserow</span>
                  </div>
                  <div className="hidden md:block text-muted-foreground">→</div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                    <span className="font-bold text-primary">3</span>
                    <span>Resposta</span>
                  </div>
                  <div className="hidden md:block text-muted-foreground">→</div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                    <span className="font-bold text-primary">4</span>
                    <span>Histórico</span>
                  </div>
                  <div className="hidden md:block text-muted-foreground">→</div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg">
                    <span className="font-bold text-primary">5</span>
                    <span>Webhooks</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration */}
          <TabsContent value="config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Guia de Configuração do Baserow
                </CardTitle>
                <CardDescription>Siga os passos abaixo para configurar a integração</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                    <div className="space-y-1">
                      <h4 className="font-medium">Criar Conta no Baserow</h4>
                      <p className="text-sm text-muted-foreground">
                        Acesse <a href="https://baserow.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">baserow.io <ExternalLink className="h-3 w-3" /></a> e crie uma conta gratuita ou faça login.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                    <div className="space-y-1">
                      <h4 className="font-medium">Gerar Token de API</h4>
                      <p className="text-sm text-muted-foreground">
                        Vá em <strong>Settings → API Token</strong> e crie um token com permissões de leitura e escrita para sua tabela.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                    <div className="space-y-1">
                      <h4 className="font-medium">Copiar URL da API</h4>
                      <p className="text-sm text-muted-foreground">
                        A URL padrão é <code className="bg-muted px-2 py-0.5 rounded text-xs">https://api.baserow.io</code>. Se usar self-hosted, use sua URL.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">4</div>
                    <div className="space-y-1">
                      <h4 className="font-medium">Obter ID da Tabela</h4>
                      <p className="text-sm text-muted-foreground">
                        Abra sua tabela no Baserow. O ID está na URL: <code className="bg-muted px-2 py-0.5 rounded text-xs">/database/X/table/<strong>123</strong></code>
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">5</div>
                    <div className="space-y-1">
                      <h4 className="font-medium">Configurar no Sistema</h4>
                      <p className="text-sm text-muted-foreground">
                        Acesse <strong>Configurações</strong> neste módulo e preencha os dados coletados. Use "Testar Conexão" para validar.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campos Recomendados na Tabela</CardTitle>
                <CardDescription>Estrutura sugerida para sua tabela no Baserow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left font-medium">Campo</th>
                        <th className="p-3 text-left font-medium">Tipo</th>
                        <th className="p-3 text-left font-medium">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3 font-mono text-xs">Número</td>
                        <td className="p-3"><Badge variant="outline">Texto</Badge></td>
                        <td className="p-3 text-muted-foreground">Campo principal de busca</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">Status</td>
                        <td className="p-3"><Badge variant="outline">Single Select</Badge></td>
                        <td className="p-3 text-muted-foreground">Status atual do número</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">Observações</td>
                        <td className="p-3"><Badge variant="outline">Long Text</Badge></td>
                        <td className="p-3 text-muted-foreground">Notas e comentários</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">Origem</td>
                        <td className="p-3"><Badge variant="outline">Texto</Badge></td>
                        <td className="p-3 text-muted-foreground">De onde veio o número</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">Data Cadastro</td>
                        <td className="p-3"><Badge variant="outline">Date</Badge></td>
                        <td className="p-3 text-muted-foreground">Quando foi cadastrado</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions */}
          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Matriz de Permissões
                </CardTitle>
                <CardDescription>Configure na área de Administração → Permissões</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left font-medium">Permissão</th>
                        <th className="p-3 text-left font-medium">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { key: 'view_consulta_numeros', desc: 'Acessar o módulo' },
                        { key: 'query_consulta_numeros', desc: 'Consultar números' },
                        { key: 'update_status_consulta_numeros', desc: 'Atualizar status' },
                        { key: 'update_obs_consulta_numeros', desc: 'Atualizar observações' },
                        { key: 'update_both_consulta_numeros', desc: 'Atualizar status + observações' },
                        { key: 'view_history_consulta_numeros', desc: 'Visualizar histórico' },
                        { key: 'export_consulta_numeros', desc: 'Exportar dados' },
                        { key: 'api_consulta_numeros', desc: 'Usar API externa' },
                        { key: 'manage_webhooks_consulta_numeros', desc: 'Gerenciar webhooks' },
                        { key: 'manage_config_consulta_numeros', desc: 'Gerenciar configurações' },
                        { key: 'view_seguros', desc: 'Visualizar aba de Seguros' },
                        { key: 'manage_seguros', desc: 'Gerenciar status de seguros' },
                        { key: 'view_scans', desc: 'Visualizar histórico de scans' },
                      ].map((perm) => (
                        <tr key={perm.key}>
                          <td className="p-3">
                            <Badge variant="secondary" className="font-mono text-xs">{perm.key}</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{perm.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  API REST - Documentação
                </CardTitle>
                <CardDescription>Endpoints disponíveis para integração</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-medium">Base URL</h4>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted p-3 rounded-lg text-sm font-mono break-all">
                      {supabaseUrl}/functions/v1/api-consulta-numeros
                    </code>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(`${supabaseUrl}/functions/v1/api-consulta-numeros`)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Autenticação</h4>
                  <p className="text-sm text-muted-foreground mb-2">Inclua o header com sua chave de API:</p>
                  <code className="block bg-muted p-3 rounded-lg text-sm font-mono">
                    x-api-key: cn_sua_chave_aqui
                  </code>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Endpoints</h4>
                  
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">GET</Badge>
                      <code className="text-sm font-mono">/consultar</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Consulta números no Baserow com busca e filtros.</p>
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Query Parameters:</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        <li><code>q</code> - Termo de busca (opcional)</li>
                        <li><code>status</code> - Filtrar por status (opcional)</li>
                        <li><code>page</code> - Página (padrão: 1)</li>
                        <li><code>size</code> - Itens por página (padrão: 25)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">PATCH</Badge>
                      <code className="text-sm font-mono">/</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Atualiza um registro no Baserow.</p>
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Body (JSON):</p>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`{
  "row_id": "123",
  "numero": "5511999999999",
  "status": "Ativo",
  "observacoes": "Número validado"
}`}</pre>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">POST</Badge>
                      <code className="text-sm font-mono">/cadastrar</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Cadastra um novo número no Baserow.</p>
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Body (JSON):</p>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`{
  "numero": "5511999999999",
  "status": "Novo",
  "observacoes": "Cadastrado via API",
  "origem": "API Externa"
}`}</pre>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">GET</Badge>
                      <code className="text-sm font-mono">/historico</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Consulta o histórico de ações.</p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">GET</Badge>
                      <code className="text-sm font-mono">/statuses</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Retorna os status disponíveis configurados no Baserow.</p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">POST</Badge>
                      <code className="text-sm font-mono">/webhook</code>
                    </div>
                    <p className="text-sm text-muted-foreground">Endpoint para receber webhooks externos (consulta ou atualização).</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  Webhooks - Notificações
                </CardTitle>
                <CardDescription>Receba notificações automáticas de eventos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-medium">Eventos Disponíveis</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { key: 'cadastro', desc: 'Quando um novo número é cadastrado' },
                      { key: 'consulta', desc: 'Quando uma consulta é realizada' },
                      { key: 'atualizacao_status', desc: 'Quando o status é atualizado' },
                      { key: 'atualizacao_obs', desc: 'Quando observações são atualizadas' },
                      { key: 'atualizacao_status_obs', desc: 'Quando ambos são atualizados' },
                    ].map((event) => (
                      <div key={event.key} className="flex items-start gap-2 p-3 border rounded-lg">
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{event.key}</Badge>
                        <span className="text-sm text-muted-foreground">{event.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-medium">Formato do Payload</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "evento": "atualizacao_status",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "dados": {
    "numero": "5511999999999",
    "row_id": "123",
    "changes": { "Status": "Ativo" },
    "previous": { ... },
    "current": { ... }
  }
}`}</pre>
                </div>

                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm">Segurança</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure uma chave secreta para validar webhooks. Ela será enviada no header <code className="bg-muted px-1 rounded">X-Webhook-Secret</code>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  Exemplos Práticos
                </CardTitle>
                <CardDescription>Exemplos em cURL para copiar e usar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  {
                    title: 'Consultar números',
                    code: `curl -X GET "${supabaseUrl}/functions/v1/api-consulta-numeros/consultar?q=5511&page=1&size=10" \\
  -H "x-api-key: cn_sua_chave_aqui"`
                  },
                  {
                    title: 'Filtrar por status',
                    code: `curl -X GET "${supabaseUrl}/functions/v1/api-consulta-numeros/consultar?status=Ativo" \\
  -H "x-api-key: cn_sua_chave_aqui"`
                  },
                  {
                    title: 'Cadastrar novo número',
                    code: `curl -X POST "${supabaseUrl}/functions/v1/api-consulta-numeros/cadastrar" \\
  -H "x-api-key: cn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "numero": "5511999999999",
    "status": "Novo",
    "observacoes": "Cadastrado via API"
  }'`
                  },
                  {
                    title: 'Atualizar status',
                    code: `curl -X PATCH "${supabaseUrl}/functions/v1/api-consulta-numeros" \\
  -H "x-api-key: cn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "row_id": "123",
    "numero": "5511999999999",
    "status": "Inativo"
  }'`
                  },
                  {
                    title: 'Consultar histórico',
                    code: `curl -X GET "${supabaseUrl}/functions/v1/api-consulta-numeros/historico?numero=5511&page=1" \\
  -H "x-api-key: cn_sua_chave_aqui"`
                  },
                ].map((example, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{example.title}</h4>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(example.code)}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                      {example.code}
                    </pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reminders */}
          <TabsContent value="reminders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Sistema de Lembretes Automáticos
                </CardTitle>
                <CardDescription>Configure notificações automáticas para monitorar números por status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  O sistema de lembretes permite enviar notificações automáticas via <strong className="text-foreground">WhatsApp</strong> e/ou <strong className="text-foreground">E-mail</strong> quando números com determinados status forem encontrados no Baserow.
                </p>
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Exemplo de uso</p>
                      <p className="text-sm text-muted-foreground">
                        Monitore números com status "EXCLUIDO" e receba alertas a cada hora com a lista de números afetados.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Envie notificações para grupos do WhatsApp via Evolution API.</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Configurar URL da API</li>
                    <li>Informar API Key</li>
                    <li>Nome da instância</li>
                    <li>ID do grupo</li>
                    <li>Opção de mencionar todos (@everyone)</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    E-mail (Gmail)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Envie e-mails automáticos via Gmail SMTP.</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>E-mail do remetente</li>
                    <li>Senha de app (não a senha normal)</li>
                    <li>Lista de destinatários</li>
                    <li>Assunto personalizado</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuração de Status</CardTitle>
                <CardDescription>Escolha quais status devem disparar os lembretes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Você pode selecionar múltiplos status para monitorar. Os status disponíveis são carregados automaticamente do Baserow.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">EXCLUIDO</Badge>
                  <Badge variant="outline">BANIDO</Badge>
                  <Badge variant="outline">PENDENTE</Badge>
                  <Badge variant="secondary">+ outros status do Baserow</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agendamento (Cron)</CardTitle>
                <CardDescription>Configure quando os lembretes devem ser enviados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left font-medium">Configuração</th>
                        <th className="p-3 text-left font-medium">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3 font-medium">Intervalo</td>
                        <td className="p-3 text-muted-foreground">A cada X horas (ex: 1, 2, 4 horas)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">Horário de Início</td>
                        <td className="p-3 text-muted-foreground">Hora para começar a executar (ex: 8h)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">Horário de Término</td>
                        <td className="p-3 text-muted-foreground">Hora para parar de executar (ex: 20h)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">Dias da Semana</td>
                        <td className="p-3 text-muted-foreground">Selecione os dias ativos (Seg, Ter, Qua...)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Template de Mensagem</CardTitle>
                <CardDescription>Personalize o conteúdo das notificações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use variáveis dinâmicas no template da mensagem:
                </p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left font-medium">Variável</th>
                        <th className="p-3 text-left font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3 font-mono text-xs">{"{{status}}"}</td>
                        <td className="p-3 text-muted-foreground">Status monitorado (ex: EXCLUIDO)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">{"{{count}}"}</td>
                        <td className="p-3 text-muted-foreground">Quantidade de números encontrados</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">{"{{numbers}}"}</td>
                        <td className="p-3 text-muted-foreground">Lista de números (formato: 5511999 - STATUS)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-xs">{"{{date}}"}</td>
                        <td className="p-3 text-muted-foreground">Data/hora da verificação</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-xs font-medium mb-2">Exemplo de Template:</p>
                  <pre className="text-xs whitespace-pre-wrap">{"⚠️ ALERTA: {{count}} números com status {{status}}\n\n📋 Lista:\n{{numbers}}\n\n🕐 Verificado em: {{date}}"}</pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Envios</CardTitle>
                <CardDescription>Acompanhe os lembretes enviados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Na aba de Lembretes você pode visualizar:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Data e hora do envio</li>
                  <li>Canal utilizado (WhatsApp ou E-mail)</li>
                  <li>Status monitorado</li>
                  <li>Quantidade de números encontrados</li>
                  <li>Status do envio (sucesso/erro)</li>
                  <li>Mensagem de erro (se houver)</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Dicas Importantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  <p><strong>Gmail:</strong> Use uma "Senha de App" em vez da senha normal. Acesse as configurações de segurança do Google para criar uma.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  <p><strong>WhatsApp:</strong> O ID do grupo pode ser obtido na Evolution API ou nas configurações do grupo.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-foreground">3.</span>
                  <p><strong>Teste:</strong> Use o botão "Testar Agora" para verificar se as configurações estão corretas antes de ativar.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-foreground">4.</span>
                  <p><strong>Horários:</strong> O cron só executa dentro do intervalo de horário configurado e nos dias selecionados.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}