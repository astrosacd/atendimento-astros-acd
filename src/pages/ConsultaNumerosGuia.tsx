import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BookOpen, Database, Key, Webhook, Shield, Code, FileText } from 'lucide-react';

export default function ConsultaNumerosGuia() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => window.location.href = '/admin/consulta-numeros'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Guia do Módulo</h1>
            <p className="text-muted-foreground">Documentação completa do Consulta de Números</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="baserow" className="gap-2">
              <Database className="h-4 w-4" />
              Baserow
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2">
              <Key className="h-4 w-4" />
              API REST
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="examples" className="gap-2">
              <Code className="h-4 w-4" />
              Exemplos
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Visão Geral do Módulo</CardTitle>
                <CardDescription>Entenda como o módulo Consulta de Números funciona</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none">
                <h3>O que é?</h3>
                <p>
                  O módulo <strong>Consulta de Números</strong> permite consultar e atualizar registros 
                  armazenados no Baserow, uma plataforma de banco de dados no-code.
                </p>

                <h3>Principais Funcionalidades</h3>
                <ul>
                  <li><strong>Consulta:</strong> Busca números por texto parcial ou completo</li>
                  <li><strong>Filtros:</strong> Filtre por status diretamente do Baserow</li>
                  <li><strong>Atualização:</strong> Altere status e observações em tempo real</li>
                  <li><strong>Histórico:</strong> Auditoria completa de todas as ações</li>
                  <li><strong>API:</strong> Integração via API REST versionada</li>
                  <li><strong>Webhooks:</strong> Notificações automáticas de eventos</li>
                </ul>

                <h3>Fluxo de Funcionamento</h3>
                <ol>
                  <li>Usuário/API/Webhook solicita uma ação (consulta ou atualização)</li>
                  <li>Sistema consulta ou atualiza o registro no Baserow</li>
                  <li>Resultado é retornado ao solicitante</li>
                  <li>Ação é registrada no histórico interno (auditoria)</li>
                  <li>Webhooks configurados são disparados (se aplicável)</li>
                </ol>

                <h3>Importante</h3>
                <p>
                  Os dados ficam armazenados no Baserow. O sistema interno armazena apenas:
                </p>
                <ul>
                  <li>Histórico de ações</li>
                  <li>Logs de auditoria</li>
                  <li>Configurações de API e Webhooks</li>
                  <li>Mapeamento de campos</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Baserow */}
          <TabsContent value="baserow">
            <Card>
              <CardHeader>
                <CardTitle>Integração com Baserow</CardTitle>
                <CardDescription>Como configurar a conexão com o Baserow</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none">
                <h3>Configuração Inicial</h3>
                <ol>
                  <li>Acesse sua conta no Baserow</li>
                  <li>Vá em <strong>Settings → API Token</strong></li>
                  <li>Crie um token com permissões de leitura e escrita</li>
                  <li>Copie a URL da API (geralmente <code>https://api.baserow.io</code>)</li>
                  <li>Anote o ID da tabela (visível na URL ao acessar a tabela)</li>
                </ol>

                <h3>Campos Esperados</h3>
                <p>A tabela no Baserow deve conter os seguintes campos:</p>
                <ul>
                  <li><strong>Número</strong> (texto) - Campo de busca principal</li>
                  <li><strong>Status</strong> (single select) - Status do número</li>
                  <li><strong>Observações</strong> (texto longo) - Notas adicionais</li>
                  <li><strong>Origem</strong> (texto) - De onde veio o número</li>
                  <li><strong>Data de Cadastro</strong> (data) - Quando foi cadastrado</li>
                  <li><strong>Última Atualização</strong> (data) - Última modificação</li>
                </ul>

                <h3>Mapeamento de Campos</h3>
                <p>
                  Na tela de <strong>Configurações</strong>, você pode mapear os nomes dos campos 
                  do sistema para os nomes usados na sua tabela do Baserow.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions */}
          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle>Matriz de Permissões</CardTitle>
                <CardDescription>Controle granular de acesso ao módulo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    O módulo possui as seguintes permissões configuráveis na Matriz de Permissões:
                  </p>
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left">Permissão</th>
                          <th className="p-3 text-left">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-3"><Badge>view_consulta_numeros</Badge></td>
                          <td className="p-3">Acessar o módulo</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>query_consulta_numeros</Badge></td>
                          <td className="p-3">Consultar números</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>update_status_consulta_numeros</Badge></td>
                          <td className="p-3">Atualizar status</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>update_obs_consulta_numeros</Badge></td>
                          <td className="p-3">Atualizar observações</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>update_both_consulta_numeros</Badge></td>
                          <td className="p-3">Atualizar status + observações</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>view_history_consulta_numeros</Badge></td>
                          <td className="p-3">Visualizar histórico</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>export_consulta_numeros</Badge></td>
                          <td className="p-3">Exportar dados</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>api_consulta_numeros</Badge></td>
                          <td className="p-3">Usar API externa</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-3"><Badge>manage_webhooks_consulta_numeros</Badge></td>
                          <td className="p-3">Gerenciar webhooks</td>
                        </tr>
                        <tr>
                          <td className="p-3"><Badge>manage_config_consulta_numeros</Badge></td>
                          <td className="p-3">Gerenciar configurações</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API REST</CardTitle>
                <CardDescription>Documentação dos endpoints disponíveis</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none">
                <h3>Base URL</h3>
                <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                  <code>{supabaseUrl}/functions/v1/api-consulta-numeros</code>
                </pre>

                <h3>Autenticação</h3>
                <p>Use o header <code>x-api-key</code> com sua chave de API:</p>
                <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                  <code>x-api-key: cn_sua_chave_aqui</code>
                </pre>

                <h3>Endpoints</h3>

                <h4>GET /consultar</h4>
                <p>Consulta números no Baserow.</p>
                <p><strong>Query Parameters:</strong></p>
                <ul>
                  <li><code>q</code> - Termo de busca (opcional)</li>
                  <li><code>status</code> - Filtrar por status (opcional)</li>
                  <li><code>page</code> - Página (padrão: 1)</li>
                  <li><code>size</code> - Itens por página (padrão: 25)</li>
                </ul>

                <h4>PATCH /</h4>
                <p>Atualiza um registro no Baserow.</p>
                <p><strong>Body (JSON):</strong></p>
                <pre className="bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "row_id": "123",
  "numero": "5511999999999",
  "status": "Ativo",
  "observacoes": "Número validado"
}`}</pre>

                <h4>GET /historico</h4>
                <p>Consulta o histórico de ações.</p>
                <p><strong>Query Parameters:</strong></p>
                <ul>
                  <li><code>numero</code> - Filtrar por número (opcional)</li>
                  <li><code>page</code> - Página (padrão: 1)</li>
                  <li><code>size</code> - Itens por página (padrão: 50)</li>
                </ul>

                <h4>GET /statuses</h4>
                <p>Retorna os status disponíveis configurados no Baserow.</p>

                <h4>POST /webhook</h4>
                <p>Endpoint para receber webhooks externos.</p>
                <p><strong>Body (JSON):</strong></p>
                <pre className="bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "action": "update",
  "row_id": "123",
  "numero": "5511999999999",
  "status": "Ativo",
  "observacoes": "Atualizado via webhook"
}`}</pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks">
            <Card>
              <CardHeader>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>Receba notificações de eventos em tempo real</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none">
                <h3>Eventos Disponíveis</h3>
                <ul>
                  <li><code>consulta</code> - Quando uma consulta é realizada</li>
                  <li><code>atualizacao_status</code> - Quando o status é atualizado</li>
                  <li><code>atualizacao_obs</code> - Quando as observações são atualizadas</li>
                  <li><code>atualizacao_status_obs</code> - Quando ambos são atualizados</li>
                </ul>

                <h3>Formato do Payload</h3>
                <pre className="bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "evento": "atualizacao_status",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "dados": {
    "numero": "5511999999999",
    "row_id": "123",
    "changes": {
      "Status": "Ativo"
    },
    "previous": { ... },
    "current": { ... }
  }
}`}</pre>

                <h3>Segurança</h3>
                <p>
                  Você pode configurar uma chave secreta para validar os webhooks recebidos.
                  A chave será enviada no header <code>X-Webhook-Secret</code>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples */}
          <TabsContent value="examples">
            <Card>
              <CardHeader>
                <CardTitle>Exemplos em cURL</CardTitle>
                <CardDescription>Exemplos práticos de uso da API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Consultar números</h4>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
{`curl -X GET "${supabaseUrl}/functions/v1/api-consulta-numeros/consultar?q=5511&page=1&size=10" \\
  -H "x-api-key: cn_sua_chave_aqui"`}</pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Consultar com filtro de status</h4>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
{`curl -X GET "${supabaseUrl}/functions/v1/api-consulta-numeros/consultar?status=Ativo" \\
  -H "x-api-key: cn_sua_chave_aqui"`}</pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Atualizar status</h4>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
{`curl -X PATCH "${supabaseUrl}/functions/v1/api-consulta-numeros" \\
  -H "x-api-key: cn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "row_id": "123",
    "numero": "5511999999999",
    "status": "Inativo"
  }'`}</pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Atualizar observações</h4>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
{`curl -X PATCH "${supabaseUrl}/functions/v1/api-consulta-numeros" \\
  -H "x-api-key: cn_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "row_id": "123",
    "observacoes": "Número verificado em 15/01/2025"
  }'`}</pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Consultar histórico</h4>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
{`curl -X GET "${supabaseUrl}/functions/v1/api-consulta-numeros/historico?numero=5511&page=1" \\
  -H "x-api-key: cn_sua_chave_aqui"`}</pre>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Enviar via Webhook</h4>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
{`curl -X POST "${supabaseUrl}/functions/v1/api-consulta-numeros/webhook" \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: sua_chave_secreta" \\
  -d '{
    "action": "update",
    "row_id": "123",
    "status": "Verificado"
  }'`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
