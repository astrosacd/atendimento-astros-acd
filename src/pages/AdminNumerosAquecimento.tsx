import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Smartphone, Plus, Search, Download, MoreHorizontal, Edit, Trash2, 
  History, Settings, Webhook, Key, FileCode, Copy, Eye, EyeOff,
  CheckCircle, AlertCircle, Clock, XCircle, ShoppingCart
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useNumerosAquecimento,
  useNumerosStatus,
  useNumerosModelos,
  useNumeroHistory,
  useNumerosWebhooks,
  useNumerosApiKeys,
  useCreateNumero,
  useUpdateNumero,
  useDeleteNumero,
  useCreateStatus,
  useUpdateStatus,
  useDeleteStatus,
  useCreateModelo,
  useUpdateModelo,
  useDeleteModelo,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
  NumeroAquecimento,
  NumeroStatus,
  NumeroModelo,
} from '@/hooks/useNumerosAquecimento';
import { toast } from 'sonner';

// Color map for status badges
const statusColorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400',
};

export default function AdminNumerosAquecimento() {
  const [activeTab, setActiveTab] = useState('numeros');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modeloFilter, setModeloFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Permissions
  const { hasPermission } = usePermissions();
  const canView = hasPermission('view_numeros_aquecimento');
  const canCreate = hasPermission('create_numeros_aquecimento');
  const canEdit = hasPermission('edit_numeros_aquecimento');
  const canChangeStatus = hasPermission('change_status_numeros');
  const canChangeObs = hasPermission('change_obs_numeros');
  const canDelete = hasPermission('delete_numeros_aquecimento');
  const canExport = hasPermission('export_numeros_aquecimento');
  const canViewHistory = hasPermission('view_history_numeros');
  const canManageWebhooks = hasPermission('manage_webhooks_numeros');
  const canManageApi = hasPermission('manage_api_numeros');
  const canManageStatus = hasPermission('manage_status_numeros');
  const canManageModelos = hasPermission('manage_modelos_numeros');

  // Data hooks
  const { data: numeros = [], isLoading } = useNumerosAquecimento({
    search: searchTerm,
    status_id: statusFilter || undefined,
    modelo_id: modeloFilter || undefined,
  });
  const { data: statusList = [] } = useNumerosStatus();
  const { data: modelosList = [] } = useNumerosModelos();
  const { data: history = [] } = useNumeroHistory();
  const { data: webhooks = [] } = useNumerosWebhooks();
  const { data: apiKeys = [] } = useNumerosApiKeys();

  // Mutations
  const createNumero = useCreateNumero();
  const updateNumero = useUpdateNumero();
  const deleteNumero = useDeleteNumero();
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();
  const createModelo = useCreateModelo();
  const updateModelo = useUpdateModelo();
  const deleteModelo = useDeleteModelo();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const createApiKey = useCreateApiKey();
  const updateApiKey = useUpdateApiKey();
  const deleteApiKey = useDeleteApiKey();

  // Pagination
  const totalPages = Math.ceil(numeros.length / pageSize);
  const paginatedNumeros = numeros.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats
  const stats = {
    total: numeros.length,
    ativos: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Ativo').length,
    aquecimento: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Em Aquecimento').length,
    bloqueados: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Bloqueado').length,
    vendidos: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Vendido').length,
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Número', 'Modelo', 'Status', 'Última Atividade', 'Observações', 'Criado em'];
    const csvRows = [headers.join(',')];

    for (const numero of numeros) {
      csvRows.push([
        `"${numero.numero}"`,
        `"${numero.modelo?.nome || '-'}"`,
        `"${statusList.find(s => s.id === numero.status_id)?.nome || '-'}"`,
        `"${numero.ultima_atividade}"`,
        `"${(numero.observacoes || '').replace(/"/g, '""')}"`,
        `"${new Date(numero.created_at).toLocaleDateString('pt-BR')}"`,
      ].join(','));
    }

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `numeros-aquecimento-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSV exportado com sucesso');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Smartphone className="h-7 w-7 text-primary" />
              Status de Números
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus números aquecidos, modelos e status
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            )}
            {canCreate && (
              <CreateNumeroDialog 
                statusList={statusList} 
                modelosList={modelosList} 
                onCreate={createNumero.mutate} 
              />
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatsCard title="Total" value={stats.total} icon={<Smartphone className="h-4 w-4" />} />
          <StatsCard title="Ativos" value={stats.ativos} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
          <StatsCard title="Em Aquecimento" value={stats.aquecimento} icon={<Clock className="h-4 w-4 text-amber-500" />} />
          <StatsCard title="Bloqueados" value={stats.bloqueados} icon={<XCircle className="h-4 w-4 text-red-500" />} />
          <StatsCard title="Vendidos" value={stats.vendidos} icon={<ShoppingCart className="h-4 w-4 text-blue-500" />} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="numeros">Números</TabsTrigger>
            <TabsTrigger value="config" disabled={!canManageStatus && !canManageModelos}>Configurações</TabsTrigger>
            <TabsTrigger value="history" disabled={!canViewHistory}>Histórico</TabsTrigger>
            <TabsTrigger value="webhooks" disabled={!canManageWebhooks}>Webhooks</TabsTrigger>
            <TabsTrigger value="api" disabled={!canManageApi}>API REST</TabsTrigger>
          </TabsList>

          {/* Números Tab */}
          <TabsContent value="numeros" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por número ou observações..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os status</SelectItem>
                      {statusList.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={modeloFilter || '__all__'} onValueChange={(v) => setModeloFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os modelos</SelectItem>
                      {modelosList.map((modelo) => (
                        <SelectItem key={modelo.id} value={modelo.id}>
                          {modelo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Última Atividade</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : paginatedNumeros.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhum número encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedNumeros.map((numero) => {
                          const status = statusList.find(s => s.id === numero.status_id);
                          return (
                            <TableRow key={numero.id}>
                              <TableCell className="font-medium">{numero.numero}</TableCell>
                              <TableCell>{numero.modelo?.nome || '-'}</TableCell>
                              <TableCell>
                                {status ? (
                                  <Badge className={statusColorMap[status.cor] || statusColorMap.gray}>
                                    {status.nome}
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {numero.ultima_atividade}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {numero.observacoes || '-'}
                              </TableCell>
                              <TableCell>
                                <NumeroActionsMenu
                                  numero={numero}
                                  statusList={statusList}
                                  modelosList={modelosList}
                                  canEdit={canEdit}
                                  canChangeStatus={canChangeStatus}
                                  canChangeObs={canChangeObs}
                                  canDelete={canDelete}
                                  canViewHistory={canViewHistory}
                                  onUpdate={(data) => updateNumero.mutate({ id: numero.id, data, previousData: numero })}
                                  onDelete={(motivo) => deleteNumero.mutate({ numero, motivo })}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages || 1}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4 items-stretch">
              {/* Status Management */}
              <Card className="flex flex-col h-[400px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Gerenciar Status
                  </CardTitle>
                  <CardDescription>Crie e edite os status disponíveis</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 overflow-hidden">
                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-2">
                      {statusList.map((status) => (
                        <div key={status.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full bg-${status.cor}-500`} />
                            <Badge className={statusColorMap[status.cor] || statusColorMap.gray}>
                              {status.nome}
                            </Badge>
                          </div>
                          {canManageStatus && (
                            <div className="flex items-center gap-1">
                              <EditStatusDialog 
                                status={status} 
                                onUpdate={(data) => updateStatus.mutate({ id: status.id, data })} 
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => deleteStatus.mutate(status.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {canManageStatus && (
                    <div className="pt-3 border-t mt-3">
                      <CreateStatusDialog onCreate={createStatus.mutate} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Modelos Management */}
              <Card className="flex flex-col h-[400px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Gerenciar Modelos
                  </CardTitle>
                  <CardDescription>Crie e edite os modelos de aparelho</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 overflow-hidden">
                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-2">
                      {modelosList.map((modelo) => (
                        <div key={modelo.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div>
                            <span className="font-medium">{modelo.nome}</span>
                            {modelo.marca && (
                              <span className="text-muted-foreground text-sm ml-2">({modelo.marca})</span>
                            )}
                          </div>
                          {canManageModelos && (
                            <div className="flex items-center gap-1">
                              <EditModeloDialog 
                                modelo={modelo} 
                                onUpdate={(data) => updateModelo.mutate({ id: modelo.id, data })} 
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => deleteModelo.mutate(modelo.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {canManageModelos && (
                    <div className="pt-3 border-t mt-3">
                      <CreateModeloDialog onCreate={createModelo.mutate} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Alterações
                </CardTitle>
                <CardDescription>Auditoria completa de todas as ações realizadas</CardDescription>
              </CardHeader>
              <CardContent>
              <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {history.map((item) => {
                      const dadosAnteriores = item.dados_anteriores as Record<string, unknown> | null;
                      const dadosNovos = item.dados_novos as Record<string, unknown> | null;
                      return (
                        <div key={item.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={
                              item.acao === 'cadastro' ? 'default' :
                              item.acao === 'exclusao' ? 'destructive' : 'secondary'
                            }>
                              {item.acao.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(item.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">{item.numero_valor}</span>
                          </div>
                          <div className="text-sm text-primary font-medium mt-1">
                            {item.usuario_email || 'Sistema'}
                          </div>
                          {item.campos_alterados && item.campos_alterados.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Campos alterados: {item.campos_alterados.join(', ')}
                            </div>
                          )}
                          {item.acao === 'edicao' && item.campos_alterados?.includes('observacoes') && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                              {dadosAnteriores?.observacoes && (
                                <div><span className="text-muted-foreground">Obs anterior:</span> <span className="line-through">{String(dadosAnteriores.observacoes)}</span></div>
                              )}
                              {dadosNovos?.observacoes && (
                                <div><span className="text-muted-foreground">Nova obs:</span> {String(dadosNovos.observacoes)}</div>
                              )}
                            </div>
                          )}
                          {item.acao === 'exclusao' && dadosAnteriores && (
                            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs space-y-1">
                              {dadosAnteriores.motivo_exclusao && (
                                <div>
                                  <span className="text-muted-foreground font-medium">Motivo:</span>{' '}
                                  <span className="text-foreground">{String(dadosAnteriores.motivo_exclusao)}</span>
                                </div>
                              )}
                              {dadosAnteriores.data_exclusao && (
                                <div>
                                  <span className="text-muted-foreground font-medium">Data da exclusão:</span>{' '}
                                  <span className="text-foreground">
                                    {new Date(String(dadosAnteriores.data_exclusao)).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                              )}
                              {dadosAnteriores.observacoes && (
                                <div>
                                  <span className="text-muted-foreground font-medium">Observações do número:</span>{' '}
                                  <span className="text-foreground">{String(dadosAnteriores.observacoes)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {history.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum histórico encontrado
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Webhooks
                  </CardTitle>
                  <CardDescription>Configure webhooks para integração externa</CardDescription>
                </div>
                <CreateWebhookDialog onCreate={createWebhook.mutate} />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{webhook.nome}</span>
                          <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                            {webhook.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={(checked) => 
                              updateWebhook.mutate({ id: webhook.id, data: { is_active: checked } })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteWebhook.mutate(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">{webhook.url}</div>
                      <div className="flex gap-1 mt-2">
                        {webhook.eventos.map((evento) => (
                          <Badge key={evento} variant="outline" className="text-xs">
                            {evento}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {webhooks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum webhook configurado
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Tab */}
          <TabsContent value="api" className="space-y-4">
            {/* API Keys */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>Gerencie suas chaves de API</CardDescription>
                </div>
                <CreateApiKeyDialog onCreate={createApiKey.mutate} />
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {apiKeys.map((key) => (
                    <ApiKeyCard 
                      key={key.id} 
                      apiKey={key}
                      onToggle={(checked) => updateApiKey.mutate({ id: key.id, data: { is_active: checked } })}
                      onDelete={() => deleteApiKey.mutate(key.id)}
                    />
                  ))}
                </div>
                {apiKeys.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma API key criada
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Documentation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  Documentação da API
                </CardTitle>
                <CardDescription>Referência completa dos endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <ApiDocumentation />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Helper Components
function StatsCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateNumeroDialog({ 
  statusList, 
  modelosList, 
  onCreate 
}: { 
  statusList: NumeroStatus[]; 
  modelosList: NumeroModelo[];
  onCreate: (data: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState('');
  const [modeloId, setModeloId] = useState<string>('');
  const [statusId, setStatusId] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  const handleSubmit = () => {
    if (!numero) {
      toast.error('Número é obrigatório');
      return;
    }
    onCreate({
      numero,
      modelo_id: modeloId || null,
      status_id: statusId || null,
      observacoes: observacoes || undefined,
    });
    setOpen(false);
    setNumero('');
    setModeloId('');
    setStatusId('');
    setObservacoes('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Número
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Número</DialogTitle>
          <DialogDescription>Adicione um novo número ao sistema</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Número *</Label>
            <Input 
              placeholder="Ex: +55 11 99999-9999" 
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>
          <div>
            <Label>Modelo</Label>
            <Select value={modeloId} onValueChange={setModeloId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelosList.map((modelo) => (
                  <SelectItem key={modelo.id} value={modelo.id}>
                    {modelo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={statusId} onValueChange={setStatusId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {statusList.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea 
              placeholder="Observações sobre o número..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumeroActionsMenu({
  numero,
  statusList,
  modelosList,
  canEdit,
  canChangeStatus,
  canChangeObs,
  canDelete,
  canViewHistory,
  onUpdate,
  onDelete,
}: {
  numero: NumeroAquecimento;
  statusList: NumeroStatus[];
  modelosList: NumeroModelo[];
  canEdit: boolean;
  canChangeStatus: boolean;
  canChangeObs: boolean;
  canDelete: boolean;
  canViewHistory: boolean;
  onUpdate: (data: Partial<NumeroAquecimento>) => void;
  onDelete: (motivo: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMotivo, setDeleteMotivo] = useState('');
  const [modeloId, setModeloId] = useState(numero.modelo_id || '');
  const [statusId, setStatusId] = useState(numero.status_id || '');
  const [observacoes, setObservacoes] = useState(numero.observacoes || '');
  
  // Fetch observation history for this number
  const { data: obsHistory = [] } = useNumeroHistory(numero.id);
  const obsChanges = obsHistory.filter(h => h.campos_alterados?.includes('observacoes'));

  const handleSave = () => {
    const updates: Partial<NumeroAquecimento> = {};
    if (canEdit && modeloId !== numero.modelo_id) updates.modelo_id = modeloId || null;
    if (canChangeStatus && statusId !== numero.status_id) updates.status_id = statusId || null;
    if (canChangeObs && observacoes !== numero.observacoes) updates.observacoes = observacoes;
    
    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
    setEditOpen(false);
  };

  const handleDelete = () => {
    if (!deleteMotivo.trim()) {
      toast.error('Informe o motivo da exclusão');
      return;
    }
    onDelete(deleteMotivo.trim());
    setDeleteOpen(false);
    setDeleteMotivo('');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(canEdit || canChangeStatus || canChangeObs) && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Número</DialogTitle>
            <DialogDescription>{numero.numero}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {canEdit && (
              <div>
                <Label>Modelo</Label>
                <Select value={modeloId} onValueChange={setModeloId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelosList.map((modelo) => (
                      <SelectItem key={modelo.id} value={modelo.id}>
                        {modelo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {canChangeStatus && (
              <div>
                <Label>Status</Label>
                <Select value={statusId} onValueChange={setStatusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusList.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {canChangeObs && (
              <div className="space-y-2">
                <Label>Observações</Label>
                {obsChanges.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="p-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <History className="h-3 w-3" />
                      Histórico de Observações
                    </div>
                    <ScrollArea className="h-[120px]">
                      <div className="p-2 space-y-2">
                        {obsChanges.map((h) => {
                          const dadosAnteriores = h.dados_anteriores as Record<string, unknown> | null;
                          const dadosNovos = h.dados_novos as Record<string, unknown> | null;
                          return (
                            <div key={h.id} className="text-xs p-2 bg-background rounded border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-muted-foreground">
                                  {new Date(h.created_at).toLocaleString('pt-BR')}
                                </span>
                                <span className="text-primary text-[10px]">{h.usuario_email}</span>
                              </div>
                              {dadosAnteriores?.observacoes && (
                                <p className="text-muted-foreground line-through">{String(dadosAnteriores.observacoes)}</p>
                              )}
                              {dadosNovos?.observacoes && (
                                <p className="text-foreground">{String(dadosNovos.observacoes)}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                <Textarea 
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Nova observação..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Você está prestes a excluir o número <strong>{numero.numero}</strong>. 
              Esta ação não pode ser desfeita, mas o histórico será preservado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivo-exclusao" className="text-sm font-medium">
                Motivo da exclusão <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo-exclusao"
                value={deleteMotivo}
                onChange={(e) => setDeleteMotivo(e.target.value)}
                placeholder="Informe o motivo da exclusão deste número..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setDeleteOpen(false);
              setDeleteMotivo('');
            }}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={!deleteMotivo.trim()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateStatusDialog({ onCreate }: { onCreate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('gray');
  const [descricao, setDescricao] = useState('');

  const handleSubmit = () => {
    if (!nome) {
      toast.error('Nome é obrigatório');
      return;
    }
    onCreate({ nome, cor, descricao: descricao || undefined });
    setOpen(false);
    setNome('');
    setCor('gray');
    setDescricao('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Novo Status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Cor</Label>
            <Select value={cor} onValueChange={setCor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="green">Verde</SelectItem>
                <SelectItem value="amber">Amarelo</SelectItem>
                <SelectItem value="red">Vermelho</SelectItem>
                <SelectItem value="blue">Azul</SelectItem>
                <SelectItem value="slate">Cinza</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStatusDialog({ status, onUpdate }: { status: NumeroStatus; onUpdate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(status.nome);
  const [cor, setCor] = useState(status.cor);
  const [descricao, setDescricao] = useState(status.descricao || '');

  const handleSubmit = () => {
    onUpdate({ nome, cor, descricao: descricao || null });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Cor</Label>
            <Select value={cor} onValueChange={setCor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="green">Verde</SelectItem>
                <SelectItem value="amber">Amarelo</SelectItem>
                <SelectItem value="red">Vermelho</SelectItem>
                <SelectItem value="blue">Azul</SelectItem>
                <SelectItem value="slate">Cinza</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateModeloDialog({ onCreate }: { onCreate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [descricao, setDescricao] = useState('');

  const handleSubmit = () => {
    if (!nome) {
      toast.error('Nome é obrigatório');
      return;
    }
    onCreate({ nome, marca: marca || undefined, descricao: descricao || undefined });
    setOpen(false);
    setNome('');
    setMarca('');
    setDescricao('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Novo Modelo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Modelo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: iPhone 15" />
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex: Apple" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditModeloDialog({ modelo, onUpdate }: { modelo: NumeroModelo; onUpdate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(modelo.nome);
  const [marca, setMarca] = useState(modelo.marca || '');
  const [descricao, setDescricao] = useState(modelo.descricao || '');

  const handleSubmit = () => {
    onUpdate({ nome, marca: marca || null, descricao: descricao || null });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Modelo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateWebhookDialog({ onCreate }: { onCreate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<string[]>([]);
  const [secretKey, setSecretKey] = useState('');

  const eventOptions = [
    'numero.created',
    'numero.updated',
    'numero.status_updated',
    'numero.obs_updated',
    'numero.modelo_updated',
    'numero.deleted',
    'status.created',
  ];

  const handleSubmit = () => {
    if (!nome || !url) {
      toast.error('Nome e URL são obrigatórios');
      return;
    }
    onCreate({ 
      nome, 
      url, 
      eventos, 
      secret_key: secretKey || undefined 
    });
    setOpen(false);
    setNome('');
    setUrl('');
    setEventos([]);
    setSecretKey('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Webhook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>URL *</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Eventos</Label>
            <div className="space-y-2 mt-2">
              {eventOptions.map((event) => (
                <label key={event} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={eventos.includes(event)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEventos([...eventos, event]);
                      } else {
                        setEventos(eventos.filter(ev => ev !== event));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{event}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Secret Key (opcional)</Label>
            <Input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateApiKeyDialog({ onCreate }: { onCreate: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const handleSubmit = () => {
    if (!nome) {
      toast.error('Nome é obrigatório');
      return;
    }
    onCreate({ nome, descricao: descricao || undefined });
    setOpen(false);
    setNome('');
    setDescricao('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova API Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeyCard({ 
  apiKey, 
  onToggle, 
  onDelete 
}: { 
  apiKey: any;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{apiKey.nome}</span>
          <Badge variant={apiKey.is_active ? 'default' : 'secondary'}>
            {apiKey.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={apiKey.is_active} onCheckedChange={onToggle} />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
          {showKey ? apiKey.api_key : '••••••••••••••••••••••••••••••••'}
        </code>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowKey(!showKey)}>
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => {
            navigator.clipboard.writeText(apiKey.api_key);
            toast.success('API Key copiada');
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      {apiKey.descricao && (
        <div className="text-sm text-muted-foreground mt-2">{apiKey.descricao}</div>
      )}
    </div>
  );
}

function CurlBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Curl copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-2 group">
      <pre className="bg-muted p-3 pr-12 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 bg-background/80 hover:bg-background border-border/50"
        onClick={handleCopy}
      >
        {copied ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function ApiDocumentation() {
  const baseUrl = 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/api-numeros-aquecimento';

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="font-semibold text-lg mb-2">Base URL</h3>
        <div className="relative group">
          <code className="block bg-muted p-3 pr-12 rounded text-xs break-all">
            {baseUrl}
          </code>
          <Button
            variant="outline"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 bg-background/80 hover:bg-background border-border/50"
            onClick={() => {
              navigator.clipboard.writeText(baseUrl);
              toast.success('URL copiada!');
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-2">Autenticação</h3>
        <p className="text-muted-foreground mb-2">
          Todas as requisições devem incluir o header <code className="bg-muted px-1 rounded">x-api-key</code>
        </p>
        <CurlBlock code={`curl -H "x-api-key: sua_api_key" \\
  ${baseUrl}`} />
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-2">Endpoints</h3>
        
        <div className="space-y-4">
          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge>GET</Badge>
              <code>/</code>
            </div>
            <p className="text-muted-foreground text-xs">Lista todos os números</p>
            <CurlBlock code={`curl -X GET -H "x-api-key: KEY" \\
  "${baseUrl}"`} />
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-600">POST</Badge>
              <code>/</code>
            </div>
            <p className="text-muted-foreground text-xs">Cria um novo número</p>
            <CurlBlock code={`curl -X POST -H "x-api-key: KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"numero": "+55...", "status_id": "...", "modelo_id": "..."}' \\
  "${baseUrl}"`} />
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-amber-600">PUT</Badge>
              <code>/:id</code>
            </div>
            <p className="text-muted-foreground text-xs">Atualiza um número</p>
            <CurlBlock code={`curl -X PUT -H "x-api-key: KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status_id": "...", "observacoes": "..."}' \\
  "${baseUrl}/UUID"`} />
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-600">DELETE</Badge>
              <code>/:id</code>
            </div>
            <p className="text-muted-foreground text-xs">Exclui um número</p>
            <CurlBlock code={`curl -X DELETE -H "x-api-key: KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"observacao": "Motivo da exclusão"}' \\
  "${baseUrl}/UUID"`} />
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge>GET</Badge>
              <code>/history/:id</code>
            </div>
            <p className="text-muted-foreground text-xs">Consulta histórico de um número</p>
            <CurlBlock code={`curl -X GET -H "x-api-key: KEY" \\
  "${baseUrl}/history/UUID"`} />
          </div>
        </div>
      </div>
    </div>
  );
}
