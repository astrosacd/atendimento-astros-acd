import { useState, useMemo } from 'react';
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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Smartphone, Plus, Search, Download, MoreHorizontal, Edit, Trash2, 
  History, Settings, Webhook, Key, FileCode, Copy, Eye, EyeOff,
  CheckCircle, AlertCircle, Clock, XCircle, ShoppingCart, Lock, RotateCcw,
  BarChart3, PieChart
} from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from 'react-i18next';
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
import { AlertConfigCard } from '@/components/numeros-aquecimento/AlertConfigCard';
import { RestoreNumbersTab } from '@/components/numeros-aquecimento/RestoreNumbersTab';

import { NumeroAnaliseInline } from '@/components/numeros-aquecimento/NumeroAnaliseInline';
import { CapacityBanner } from '@/components/numeros-aquecimento/CapacityBanner';
import { useActiveCheckinsByModelo } from '@/hooks/useCheckinDiario';
import { toast } from 'sonner';
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';
import { cn } from '@/lib/utils';

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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('numeros');
  const [numerosSubTab, setNumerosSubTab] = useState<'estoque' | 'vendidos'>('estoque');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modeloFilter, setModeloFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageVendidos, setCurrentPageVendidos] = useState(1);
  const pageSize = 15;

  // Permissions
  const { hasPermission } = usePermissions();
  const canView = hasPermission('view_numeros_aquecimento');
  const canCreate = hasPermission('create_numeros_aquecimento');
  const canEdit = hasPermission('edit_numeros_aquecimento');
  const canChangeStatus = hasPermission('change_status_numeros');
  const canChangeObs = hasPermission('change_obs_numeros');
  const canDelete = hasPermission('delete_numeros_aquecimento');
  const canDeleteSold = hasPermission('delete_sold_numeros');
  const canDeleteSoldPermanent = hasPermission('delete_sold_numeros_permanent');
  const canExport = hasPermission('export_numeros_aquecimento');
  const canViewHistory = hasPermission('view_history_numeros');
  const canManageWebhooks = hasPermission('manage_webhooks_numeros');
  const canManageApi = hasPermission('manage_api_numeros');
  const canManageStatus = hasPermission('manage_status_numeros');
  const canManageModelos = hasPermission('manage_modelos_numeros');
  const canRestoreNumbers = hasPermission('restore_numeros_aquecimento');
  const canReturnToStock = hasPermission('return_to_stock_numeros');

  // Data hooks
  const { data: numeros = [], isLoading } = useNumerosAquecimento({
    search: searchTerm,
    status_id: statusFilter || undefined,
    modelo_id: modeloFilter || undefined,
  });
  // Lista completa (sem filtros) usada apenas pelo banner de capacidade,
  // para não mostrar "vagas disponíveis" falsas quando o usuário pesquisa.
  const { data: numerosTotais = [], isLoading: loadingTotais } = useNumerosAquecimento();
  const { data: statusList = [], isLoading: loadingStatus } = useNumerosStatus();
  const { data: modelosList = [], isLoading: loadingModelos } = useNumerosModelos();
  const checkinExtraByModelo = useActiveCheckinsByModelo();
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

  // Separate numbers by sold status
  const vendidoStatusId = statusList.find(s => s.nome === 'Vendido')?.id;
  const numerosEmEstoque = numeros.filter(n => n.status_id !== vendidoStatusId);
  const numerosVendidos = numeros.filter(n => n.status_id === vendidoStatusId);

  // Pagination for "Em Estoque"
  const totalPagesEstoque = Math.ceil(numerosEmEstoque.length / pageSize);
  const paginatedNumerosEstoque = numerosEmEstoque.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Pagination for "Vendidos"
  const totalPagesVendidos = Math.ceil(numerosVendidos.length / pageSize);
  const paginatedNumerosVendidos = numerosVendidos.slice((currentPageVendidos - 1) * pageSize, currentPageVendidos * pageSize);

  // Stats
  const stats = {
    total: numeros.length,
    ativos: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Ativo').length,
    aquecimento: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Em Aquecimento').length,
    bloqueados: numeros.filter(n => statusList.find(s => s.id === n.status_id)?.nome === 'Bloqueado').length,
    vendidos: numerosVendidos.length,
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

  // Prepare chart data
  const chartData = useMemo(() => {
    return [
      { name: 'Ativos', value: stats.ativos, color: '#22c55e' },
      { name: 'Em Aquecimento', value: stats.aquecimento, color: '#f59e0b' },
      { name: 'Bloqueados', value: stats.bloqueados, color: '#ef4444' },
      { name: 'Vendidos', value: stats.vendidos, color: '#3b82f6' },
    ].filter(d => d.value > 0);
  }, [stats]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Smartphone className="h-7 w-7 text-primary" />
              {t('numberStatus.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('numberStatus.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canExport && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-2" />
                {t('numberStatus.exportCsv')}
              </Button>
            )}
            {canCreate && (
              <CreateNumeroDialog 
                statusList={statusList} 
                modelosList={modelosList} 
                existingNumeros={numerosTotais}
                extraOcupadosByModelo={checkinExtraByModelo}
                onCreate={createNumero.mutate}
                isCreating={createNumero.isPending}
              />

            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatsCard title={t('numberStatus.total')} value={stats.total} icon={<Smartphone className="h-4 w-4" />} />
          <StatsCard title={t('numberStatus.active')} value={stats.ativos} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
          <StatsCard title={t('numberStatus.warmingUp')} value={stats.aquecimento} icon={<Clock className="h-4 w-4 text-amber-500" />} />
          <StatsCard title={t('numberStatus.blocked')} value={stats.bloqueados} icon={<XCircle className="h-4 w-4 text-red-500" />} />
          <StatsCard title={t('numberStatus.sold')} value={stats.vendidos} icon={<ShoppingCart className="h-4 w-4 text-blue-500" />} />
        </div>

        {/* Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Distribuição de Status
            </CardTitle>
            <CardDescription>Visão percentual da composição do estoque de números</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.total > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'hsl(var(--popover-foreground))'
                        }}
                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 600 }}
                        formatter={(value: number, name: string) => [
                          `${value} (${((value / stats.total) * 100).toFixed(1)}%)`, 
                          name
                        ]}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {chartData.map((item) => {
                    const pct = ((item.value / stats.total) * 100).toFixed(1);
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                            <span className="font-medium text-foreground">{item.name}</span>
                          </div>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {item.value} <span className="text-xs">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all" 
                            style={{ width: `${pct}%`, background: item.color }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground italic">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 h-auto">
            <TabsTrigger value="numeros">{t('numberStatus.numbers')}</TabsTrigger>
            <TabsTrigger value="config" disabled={!canManageStatus && !canManageModelos}>{t('numberStatus.config')}</TabsTrigger>
            <TabsTrigger value="history" disabled={!canViewHistory}>{t('numberStatus.history')}</TabsTrigger>
            <TabsTrigger value="restore" disabled={!canRestoreNumbers}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Restaurar
            </TabsTrigger>
            <TabsTrigger value="webhooks" disabled={!canManageWebhooks}>{t('numberStatus.webhooks')}</TabsTrigger>
            <TabsTrigger value="api" disabled={!canManageApi}>{t('numberStatus.apiRest')}</TabsTrigger>
          </TabsList>

          {/* Números Tab */}
          <TabsContent value="numeros" className="space-y-4">
            {/* Capacity Banner */}
            {!(loadingTotais || loadingModelos || loadingStatus) && (
              <CapacityBanner numeros={numerosTotais} modelosList={modelosList} statusList={statusList} extraOcupadosByModelo={checkinExtraByModelo} />
            )}
            {/* Sub-tabs for Em Estoque / Vendidos */}
            <div className="flex items-center gap-2 border-b pb-2">
              <Button
                variant={numerosSubTab === 'estoque' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setNumerosSubTab('estoque'); setCurrentPage(1); }}
                className="gap-2"
              >
                <Smartphone className="h-4 w-4" />
                Em Estoque
                <Badge variant="secondary" className="ml-1">{numerosEmEstoque.length}</Badge>
              </Button>
              <Button
                variant={numerosSubTab === 'vendidos' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setNumerosSubTab('vendidos'); setCurrentPageVendidos(1); }}
                className="gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Vendidos
                <Badge variant="secondary" className="ml-1">{numerosVendidos.length}</Badge>
              </Button>
            </div>

            {/* Filters - only show for Em Estoque tab */}
            {numerosSubTab === 'estoque' && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={t('numberStatus.searchPlaceholder')}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('numberStatus.filterByStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t('numberStatus.allStatuses')}</SelectItem>
                        {statusList.filter(s => s.nome !== 'Vendido').map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <SearchableSelect
                      options={[
                        { value: '__all__', label: t('numberStatus.allModels') },
                        ...modelosList.map((modelo) => ({
                          value: modelo.id,
                          label: modelo.nome,
                        }))
                      ]}
                      value={modeloFilter || '__all__'}
                      onValueChange={(v) => setModeloFilter(v === '__all__' ? '' : v)}
                      placeholder={t('numberStatus.filterByModel')}
                      searchPlaceholder="Buscar modelo..."
                      emptyMessage="Nenhum modelo encontrado."
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Filters - for Vendidos tab */}
            {numerosSubTab === 'vendidos' && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('numberStatus.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <SearchableSelect
                      options={[
                        { value: '__all__', label: t('numberStatus.allModels') },
                        ...modelosList.map((modelo) => ({
                          value: modelo.id,
                          label: modelo.nome,
                        }))
                      ]}
                      value={modeloFilter || '__all__'}
                      onValueChange={(v) => setModeloFilter(v === '__all__' ? '' : v)}
                      placeholder={t('numberStatus.filterByModel')}
                      searchPlaceholder="Buscar modelo..."
                      emptyMessage="Nenhum modelo encontrado."
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Table - Em Estoque */}
            {numerosSubTab === 'estoque' && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('numberStatus.number')}</TableHead>
                          <TableHead>{t('numberStatus.model')}</TableHead>
                          <TableHead>{t('numberStatus.status')}</TableHead>
                          <TableHead>Análise</TableHead>
                          <TableHead>{t('numberStatus.lastActivity')}</TableHead>
                          <TableHead>{t('numberStatus.observations')}</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              {t('numberStatus.loading')}
                            </TableCell>
                          </TableRow>
                        ) : paginatedNumerosEstoque.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              {t('numberStatus.noNumbers')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedNumerosEstoque.map((numero) => {
                            const status = statusList.find(s => s.id === numero.status_id);
                            const modelo = numero.modelo;
                            const ocupadosModelo = modelo ? numeros.filter(n => n.modelo_id === modelo.id && n.status_id !== vendidoStatusId).length : 0;
                            return (
                              <TableRow key={numero.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {numero.numero}
                                    {numero.tipo_whatsapp && (
                                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                                        {numero.tipo_whatsapp === 'business' ? 'B' : 'N'}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span>{modelo?.nome || '-'}</span>
                                    {modelo && modelo.capacidade_whatsapp > 0 && (
                                      <Badge variant="secondary" className="h-4 text-[9px] px-1">
                                        {ocupadosModelo}/{modelo.capacidade_whatsapp}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {status ? (
                                    <Badge className={statusColorMap[status.cor] || statusColorMap.gray}>
                                      {status.nome}
                                    </Badge>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  <NumeroAnaliseInline numero={numero} statusList={statusList} />
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
                                    existingNumeros={numerosTotais}
                                    canEdit={canEdit}
                                    canChangeStatus={canChangeStatus}
                                    canChangeObs={canChangeObs}
                                    canDelete={canDelete}
                                    canDeleteSold={canDeleteSoldPermanent}
                                    canReturnToStock={canReturnToStock}
                                    canViewHistory={canViewHistory}
                                    isVendido={false}
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
                      {t('numberStatus.page')} {currentPage} {t('numberStatus.of')} {totalPagesEstoque || 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        {t('numberStatus.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPagesEstoque, p + 1))}
                        disabled={currentPage >= totalPagesEstoque}
                      >
                        {t('numberStatus.next')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Table - Vendidos */}
            {numerosSubTab === 'vendidos' && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('numberStatus.number')}</TableHead>
                          <TableHead>{t('numberStatus.model')}</TableHead>
                          <TableHead>{t('numberStatus.lastActivity')}</TableHead>
                          <TableHead>{t('numberStatus.observations')}</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {t('numberStatus.loading')}
                            </TableCell>
                          </TableRow>
                        ) : paginatedNumerosVendidos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nenhum número vendido encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedNumerosVendidos.map((numero) => {
                            return (
                              <TableRow key={numero.id} className="bg-muted/30">
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {numero.numero}
                                    <span title="Número vendido - bloqueado para edição">
                                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{numero.modelo?.nome || '-'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {numero.ultima_atividade}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                  {numero.observacoes ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="block truncate cursor-default">{numero.observacoes}</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[400px] whitespace-pre-wrap">
                                          {numero.observacoes}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  <NumeroActionsMenu
                                    numero={numero}
                                    statusList={statusList}
                                    modelosList={modelosList}
                                    existingNumeros={numerosTotais}
                                    canEdit={canEdit}
                                    canChangeStatus={canChangeStatus}
                                    canChangeObs={canChangeObs}
                                    canDelete={canDelete}
                                    canDeleteSold={canDeleteSoldPermanent}
                                    canReturnToStock={canReturnToStock}
                                    canViewHistory={canViewHistory}
                                    isVendido={true}
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
                      {t('numberStatus.page')} {currentPageVendidos} {t('numberStatus.of')} {totalPagesVendidos || 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageVendidos(p => Math.max(1, p - 1))}
                        disabled={currentPageVendidos === 1}
                      >
                        {t('numberStatus.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPageVendidos(p => Math.min(totalPagesVendidos, p + 1))}
                        disabled={currentPageVendidos >= totalPagesVendidos}
                      >
                        {t('numberStatus.next')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4">
            {/* Alert Configuration - Full Width */}
            <AlertConfigCard />
            
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
                      {statusList.map((status) => {
                        const count = numeros.filter(n => n.status_id === status.id).length;
                        return (
                          <div key={status.id} className="flex items-center justify-between p-2 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full bg-${status.cor}-500`} />
                              <Badge className={statusColorMap[status.cor] || statusColorMap.gray}>
                                {status.nome}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {count} número{count !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            {canManageStatus && (
                              <div className="flex items-center gap-1">
                                <EditStatusDialog 
                                  status={status} 
                                  onUpdate={(data) => updateStatus.mutate({ id: status.id, data })} 
                                />
                                <DeleteStatusDialog
                                  status={status}
                                  count={count}
                                  onDelete={deleteStatus.mutate}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                      {modelosList.map((modelo) => {
                        const count = numeros.filter(n => n.modelo_id === modelo.id).length;
                        const apareceCheckin = modelo.aparece_no_checkin !== false;
                        const extraModelo = checkinExtraByModelo?.get(modelo.id)?.total ?? 0;
                        const ocupadosModelo = count + extraModelo;
                        const cheioModelo =
                          modelo.capacidade_whatsapp > 0 && ocupadosModelo >= modelo.capacidade_whatsapp;
                        return (
                          <div
                            key={modelo.id}
                            className={cn(
                              "flex items-center justify-between p-2 border rounded-lg",
                              cheioModelo && "opacity-60 bg-muted/40"
                            )}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{modelo.nome}</span>
                              {modelo.marca && (
                                <span className="text-sm text-muted-foreground">({modelo.marca})</span>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {count} número{count !== 1 ? 's' : ''}
                              </Badge>
                              {modelo.capacidade_whatsapp > 0 && (
                                <Badge variant="outline" className="text-[10px]">
                                  {ocupadosModelo}/{modelo.capacidade_whatsapp}
                                </Badge>
                              )}
                              {cheioModelo && (
                                <Badge variant="destructive" className="text-[10px]">
                                  cheio
                                </Badge>
                              )}
                              {!apareceCheckin && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Oculto no check-in
                                </Badge>
                              )}
                              {modelo.tipo_whatsapp ? (
                                <Badge variant="outline" className="text-[10px]">
                                  {modelo.tipo_whatsapp === 'business' ? '💼 Business' : '📱 Normal'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">
                                  Tipo não definido
                                </Badge>
                              )}
                            </div>
                            {canManageModelos && (
                              <div className="flex items-center gap-1">
                                <div className="flex items-center gap-1 mr-1" title="Aparece na lista do check-in (QR Scan)">
                                  <Switch
                                    checked={apareceCheckin}
                                    onCheckedChange={(v) => updateModelo.mutate({ id: modelo.id, data: { aparece_no_checkin: v } })}
                                  />
                                  <span className="text-[10px] text-muted-foreground hidden md:inline">Check-in</span>
                                </div>
                                <EditModeloDialog 
                                  modelo={modelo} 
                                  onUpdate={(data) => updateModelo.mutate({ id: modelo.id, data })} 
                                />
                                <DeleteModeloDialog
                                  modelo={modelo}
                                  count={count}
                                  onDelete={deleteModelo.mutate}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
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

          {/* Restore Tab */}
          <TabsContent value="restore" className="space-y-4">
            <RestoreNumbersTab statusList={statusList} modelosList={modelosList} />
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
  existingNumeros,
  extraOcupadosByModelo,
  onCreate,
  isCreating
}: { 
  statusList: NumeroStatus[]; 
  modelosList: NumeroModelo[];
  existingNumeros: NumeroAquecimento[];
  extraOcupadosByModelo?: Map<string, { total: number; normal: number; business: number; clone: number }>;
  onCreate: (data: any, options: { onSuccess: () => void }) => void;
  isCreating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState('');
  const [modeloId, setModeloId] = useState<string>('');
  const [statusId, setStatusId] = useState<string>('');
  const [tipoWhatsapp, setTipoWhatsapp] = useState<'' | 'normal' | 'business'>('');
  const [observacoes, setObservacoes] = useState('');

  // Normalize number for comparison (remove spaces, dashes, parentheses)
  const normalizeNumber = (num: string) => num.replace(/[\s\-\(\)\.]/g, '');

  // Excluir números vendidos do cálculo de capacidade (são só do estoque)
  const vendidoStatusId = statusList.find((s) => s.nome === 'Vendido')?.id;
  const numerosEstoque = vendidoStatusId
    ? existingNumeros.filter((n) => n.status_id !== vendidoStatusId)
    : existingNumeros;

  // Opções de modelo com indicação de capacidade ocupada
  // (inclui slots ocupados por check-ins ativos de auto-hospedados — sincroniza com QR Scans)
  const modeloOptions = modelosList.map((m) => {
    const doModelo = numerosEstoque.filter((n) => n.modelo_id === m.id);
    const internos = doModelo.length;
    const internosNormal = doModelo.filter((n) => n.tipo_whatsapp === 'normal').length;
    const internosBusiness = doModelo.filter((n) => n.tipo_whatsapp === 'business').length;
    const extraInfo = extraOcupadosByModelo?.get(m.id);
    const extra = extraInfo?.total ?? 0;
    const ocupados = internos + extra;
    const cheio = m.capacidade_whatsapp > 0 && ocupados >= m.capacidade_whatsapp;
    const tooltip = (
      <div className="space-y-1">
        <div className="font-semibold">
          Ocupação: {ocupados}{m.capacidade_whatsapp > 0 ? ` / ${m.capacidade_whatsapp}` : ''}
        </div>
        <div>📱 Internos (Status Números): <strong>{internos}</strong></div>
        {internos > 0 && (
          <div className="pl-3 text-muted-foreground">
            • Normal: {internosNormal} · Business: {internosBusiness}
          </div>
        )}
        <div>🔲 Auto-hospedados (QR Scans): <strong>{extra}</strong></div>
        {extra > 0 && extraInfo && (
          <div className="pl-3 text-muted-foreground">
            • Normal: {extraInfo.normal} · Business: {extraInfo.business}
            {extraInfo.clone > 0 ? ` · Clone: ${extraInfo.clone}` : ''}
          </div>
        )}
        {cheio && (
          <div className="pt-1 text-destructive font-medium">⚠️ Capacidade esgotada</div>
        )}
      </div>
    );
    return {
      value: m.id,
      label: `${m.nome}${m.capacidade_whatsapp > 0 ? ` (${ocupados}/${m.capacidade_whatsapp})` : ''}${cheio ? ' - cheio' : ''}`,
      tooltip,
    };
  });


  const handleSubmit = () => {
    if (!numero) {
      toast.error('Número é obrigatório');
      return;
    }

    if (!tipoWhatsapp) {
      toast.error('Tipo de WhatsApp é obrigatório');
      return;
    }

    // Check for duplicate number
    const normalizedInput = normalizeNumber(numero);
    const isDuplicate = existingNumeros.some(
      (n) => normalizeNumber(n.numero) === normalizedInput
    );

    if (isDuplicate) {
      toast.error('Este número já está cadastrado no sistema');
      return;
    }

    // Validar capacidade do modelo
    if (modeloId) {
      const modelo = modelosList.find((m) => m.id === modeloId);
      if (modelo && modelo.capacidade_whatsapp > 0) {
        const doModelo = numerosEstoque.filter((n) => n.modelo_id === modeloId);
        const extra = extraOcupadosByModelo?.get(modeloId)?.total ?? 0;
        const ocupados = doModelo.length + extra;

        if (ocupados >= modelo.capacidade_whatsapp) {
          const tipoLabel = tipoWhatsapp === 'business' ? 'Business' : 'Normal';
          toast.error(
            `Não é possível cadastrar: o modelo "${modelo.nome}" já está cheio (${ocupados}/${modelo.capacidade_whatsapp}). Ajuste o limite do modelo em Configurações ou escolha outro modelo.`,
            { duration: 6000, description: `Tentativa de adicionar mais 1 ${tipoLabel} além da capacidade.` }
          );
          return;
        }
      }
    }

    onCreate({
      numero,
      modelo_id: modeloId || null,
      status_id: statusId || null,
      tipo_whatsapp: tipoWhatsapp,
      observacoes: observacoes || undefined,
    }, {
      onSuccess: () => {
        setOpen(false);
        setNumero('');
        setModeloId('');
        setStatusId('');
        setTipoWhatsapp('');
        setObservacoes('');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Número
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <SearchableSelect
              options={modeloOptions}
              value={modeloId}
              onValueChange={(v) => {
                setModeloId(v);
                const m = modelosList.find((mo) => mo.id === v);
                if (m?.tipo_whatsapp) setTipoWhatsapp(m.tipo_whatsapp);
              }}
              placeholder="Selecione o modelo"
              searchPlaceholder="Buscar modelo..."
              emptyMessage="Nenhum modelo encontrado."
            />
          </div>
          <div>
            <Label>Tipo WhatsApp *</Label>
            <Select
              value={tipoWhatsapp}
              onValueChange={(v) => setTipoWhatsapp(v as 'normal' | 'business')}
              disabled={!!modelosList.find((mo) => mo.id === modeloId)?.tipo_whatsapp}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">📱 WhatsApp Normal</SelectItem>
                <SelectItem value="business">💼 WhatsApp Business</SelectItem>
              </SelectContent>
            </Select>
            {modelosList.find((mo) => mo.id === modeloId)?.tipo_whatsapp && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Tipo definido automaticamente pelo modelo selecionado
              </p>
            )}
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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isCreating}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumeroActionsMenu({
  numero,
  statusList,
  modelosList,
  existingNumeros,
  canEdit,
  canChangeStatus,
  canChangeObs,
  canDelete,
  canDeleteSold,
  canReturnToStock,
  canViewHistory,
  isVendido,
  onUpdate,
  onDelete,
}: {
  numero: NumeroAquecimento;
  statusList: NumeroStatus[];
  modelosList: NumeroModelo[];
  existingNumeros: NumeroAquecimento[];
  canEdit: boolean;
  canChangeStatus: boolean;
  canChangeObs: boolean;
  canDelete: boolean;
  canDeleteSold: boolean;
  canReturnToStock: boolean;
  canViewHistory: boolean;
  isVendido: boolean;
  onUpdate: (data: Partial<NumeroAquecimento>) => void;
  onDelete: (motivo: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmBanOpen, setConfirmBanOpen] = useState(false);
  const [confirmVoltarEstoqueOpen, setConfirmVoltarEstoqueOpen] = useState(false);
  const [voltarEstoqueModeloId, setVoltarEstoqueModeloId] = useState<string>('');
  const [voltarEstoqueTipo, setVoltarEstoqueTipo] = useState<'normal' | 'business' | ''>('');
  const [deleteMotivo, setDeleteMotivo] = useState('');
  const [modeloId, setModeloId] = useState(numero.modelo_id || '');
  const [statusId, setStatusId] = useState(numero.status_id || '');
  const [tipoWhatsapp, setTipoWhatsapp] = useState<'normal' | 'business' | ''>('');
  const [observacoes, setObservacoes] = useState(numero.observacoes || '');
  const [nomeCliente, setNomeCliente] = useState('');
  const [whatsappCliente, setWhatsappCliente] = useState('');
  const [tipoSeguro, setTipoSeguro] = useState<'COM SEGURO' | 'SEM SEGURO' | ''>('');
  const [confirmVendaOpen, setConfirmVendaOpen] = useState(false);
  const [isChangingToVendido, setIsChangingToVendido] = useState(false);
  
  // Fetch observation history for this number
  const { data: obsHistory = [] } = useNumeroHistory(numero.id);
  const obsChanges = obsHistory.filter(h => h.campos_alterados?.includes('observacoes'));

  // Determinar se pode excluir este número específico
  const canDeleteThisNumber = isVendido ? canDeleteSold : canDelete;

  const handleSave = () => {
    if (isVendido) {
      toast.error('Números vendidos não podem ser alterados');
      setEditOpen(false);
      return;
    }

    if (canEdit && !tipoWhatsapp) {
      toast.error('Selecione o tipo de WhatsApp (Normal ou Business)');
      return;
    }

    const vendidoStatusId = statusList.find((s) => s.nome === 'Vendido')?.id;
    const isVendidoNow = statusId === vendidoStatusId && numero.status_id !== vendidoStatusId;

    if (isVendidoNow) {
      setConfirmVendaOpen(true);
      return;
    }

    proceedWithSave();
  };

  const proceedWithSave = (extraObs?: string) => {
    // Validar capacidade ao trocar de modelo
    if (canEdit && modeloId && modeloId !== numero.modelo_id) {
      const modelo = modelosList.find((m) => m.id === modeloId);
      if (modelo && modelo.capacidade_whatsapp > 0) {
        const vendidoStatusId = statusList.find((s) => s.nome === 'Vendido')?.id;
        const ocupados = existingNumeros.filter(
          (n) => n.modelo_id === modeloId && n.id !== numero.id && n.status_id !== vendidoStatusId
        ).length;
        if (ocupados >= modelo.capacidade_whatsapp) {
          toast.error(
            `Não é possível mover para "${modelo.nome}": modelo já está cheio (${ocupados}/${modelo.capacidade_whatsapp}). Ajuste o limite em Configurações ou escolha outro modelo.`,
            { duration: 6000 }
          );
          return;
        }
      }
    }

    const updates: Partial<NumeroAquecimento> = {};
    if (canEdit && modeloId !== numero.modelo_id) updates.modelo_id = modeloId || null;
    if (canEdit && tipoWhatsapp && tipoWhatsapp !== numero.tipo_whatsapp) updates.tipo_whatsapp = tipoWhatsapp;
    if (canChangeStatus && statusId !== numero.status_id) updates.status_id = statusId || null;
    
    const finalObs = extraObs ? extraObs : observacoes;
    if (canChangeObs && finalObs !== numero.observacoes) updates.observacoes = finalObs;
    
    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
    setEditOpen(false);
  };

  const handleConfirmVenda = () => {
    if (!nomeCliente.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (!whatsappCliente.trim()) {
      toast.error('Informe o número de contato do cliente');
      return;
    }

    if (!tipoSeguro) {
      toast.error('Selecione o tipo de chip (com ou sem seguro)');
      return;
    }

    const extraObs = `${nomeCliente.trim()} - CHIP PRO ${tipoSeguro} - ${whatsappCliente.trim()}`;
    proceedWithSave(extraObs);
    setConfirmVendaOpen(false);
  };

  // Modelos com vagas para escolher no retorno ao estoque
  const checkinOcupadosRetorno = useActiveCheckinsByModelo();
  const modelosVagasRetorno = useMemo(() => {
    const vendidoId = statusList.find((s) => s.nome === 'Vendido')?.id;
    const estoque = vendidoId
      ? existingNumeros.filter((n) => n.status_id !== vendidoId && n.id !== numero.id)
      : existingNumeros.filter((n) => n.id !== numero.id);

    return modelosList
      .map((m) => {
        const internos = new Set(estoque.filter((n) => n.modelo_id === m.id).map((n) => n.numero));
        const extras = (checkinOcupadosRetorno.get(m.id) as { numbers?: Set<string> } | undefined)?.numbers ?? new Set<string>();
        const ocupados = new Set([...internos, ...extras]).size;
        const capacidade = m.capacidade_whatsapp ?? 0;
        const livres = capacidade > 0 ? Math.max(0, capacidade - ocupados) : 1;
        return { modelo: m, ocupados, capacidade, livres };
      })
      .sort((a, b) => {
        if ((a.livres > 0) !== (b.livres > 0)) return a.livres > 0 ? -1 : 1;
        return a.modelo.nome.localeCompare(b.modelo.nome, 'pt-BR');
      });
  }, [modelosList, existingNumeros, statusList, checkinOcupadosRetorno, numero.id]);


  const handleVoltarEstoque = () => {
    const ativoStatusId = statusList.find(s => s.nome === 'Ativo')?.id;
    if (!ativoStatusId) {
      toast.error('Status "Ativo" não encontrado. Verifique as configurações de status.');
      return;
    }

    if (!voltarEstoqueModeloId) {
      toast.error('Selecione o modelo do aparelho para o retorno');
      return;
    }

    if (!voltarEstoqueTipo) {
      toast.error('Selecione o tipo de WhatsApp (Normal ou Business)');
      return;
    }

    const escolhido = modelosVagasRetorno.find((o) => o.modelo.id === voltarEstoqueModeloId);
    if (escolhido && escolhido.livres <= 0) {
      toast.error(`Modelo "${escolhido.modelo.nome}" está cheio (${escolhido.ocupados}/${escolhido.capacidade}). Escolha outro modelo.`);
      return;
    }

    onUpdate({
      status_id: ativoStatusId,
      modelo_id: voltarEstoqueModeloId,
      tipo_whatsapp: voltarEstoqueTipo,
      observacoes: '', // Limpa os dados do cliente anterior ao voltar para o estoque
    });
    setConfirmVoltarEstoqueOpen(false);
    toast.success(
      escolhido
        ? `Número voltou para o estoque no modelo ${escolhido.modelo.nome}`
        : 'Número voltou para o estoque com sucesso'
    );
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

  // Se o número é vendido e não tem permissão para realizar nenhuma ação, desabilita o menu
  const canAnyAction = isVendido 
    ? (canReturnToStock || canDeleteSold)
    : (canEdit || canChangeStatus || canChangeObs || canDeleteThisNumber);

  if (!canAnyAction) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
        <Lock className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isVendido && (canEdit || canChangeStatus || canChangeObs) && (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}
          {isVendido && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <Lock className="h-4 w-4 mr-2" />
              Bloqueado (Vendido)
            </DropdownMenuItem>
          )}
          {isVendido && canReturnToStock && (
            <DropdownMenuItem 
              onClick={() => setConfirmVoltarEstoqueOpen(true)}
              className="text-blue-600 dark:text-blue-400 font-medium"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Voltar para o estoque
            </DropdownMenuItem>
          )}
          {!isVendido && canDeleteThisNumber && (
            <>
              <DropdownMenuItem 
                className="text-destructive font-medium"
                onClick={() => {
                  setConfirmBanOpen(true);
                }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Banido Permanentemente
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir (Outro motivo)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Número</DialogTitle>
            <DialogDescription>{numero.numero}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {canEdit && (
              <>
                <div>
                  <Label>Modelo</Label>
                  <SearchableSelect
                    options={modelosList.map((modelo) => ({
                      value: modelo.id,
                      label: modelo.nome,
                    }))}
                    value={modeloId}
                    onValueChange={(v) => {
                      setModeloId(v);
                      const m = modelosList.find((mo) => mo.id === v);
                      if (m?.tipo_whatsapp) setTipoWhatsapp(m.tipo_whatsapp);
                    }}
                    placeholder="Selecione o modelo"
                    searchPlaceholder="Buscar modelo..."
                    emptyMessage="Nenhum modelo encontrado."
                  />
                </div>
                <div>
                  <Label>Tipo WhatsApp *</Label>
                  <Select
                    value={tipoWhatsapp}
                    onValueChange={(v) => setTipoWhatsapp(v as 'normal' | 'business')}
                    disabled={!!modelosList.find((mo) => mo.id === modeloId)?.tipo_whatsapp}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de WhatsApp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">📱 WhatsApp Normal</SelectItem>
                      <SelectItem value="business">💼 WhatsApp Business</SelectItem>
                    </SelectContent>
                  </Select>
                  {modelosList.find((mo) => mo.id === modeloId)?.tipo_whatsapp && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Tipo definido automaticamente pelo modelo selecionado
                    </p>
                  )}
                </div>
              </>
            )}
            {canChangeStatus && (
              <div>
                <Label>Status</Label>
                <Select 
                  value={statusId} 
                  onValueChange={(v) => {
                    setStatusId(v);
                    const vendidoStatusId = statusList.find((s) => s.nome === 'Vendido')?.id;
                    setIsChangingToVendido(v === vendidoStatusId && numero.status_id !== vendidoStatusId);
                  }}
                >
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
                {isChangingToVendido && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                    <ShoppingCart className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Você selecionou <strong>Vendido</strong>. Clique em <strong>Salvar</strong> para prosseguir e informar os dados do cliente da venda.
                    </span>
                  </div>
                )}
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
      {/* Venda Confirmation Dialog */}
      <Dialog open={confirmVendaOpen} onOpenChange={setConfirmVendaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Confirmar Venda de Número
              </div>
              <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Número em Venda</p>
                <p className="text-2xl font-bold font-mono text-primary">{numero.numero}</p>
              </div>
            </DialogTitle>
            <DialogDescription>
              Para marcar como vendido, preencha as informações obrigatórias abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-cliente-venda">Nome do Cliente <span className="text-destructive">*</span></Label>
              <Input
                id="nome-cliente-venda"
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                placeholder="Ex: Wilder Tecnologia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-cliente-venda">Número/WhatsApp do Cliente <span className="text-destructive">*</span></Label>
              <Input
                id="whatsapp-cliente-venda"
                value={whatsappCliente}
                onChange={(e) => setWhatsappCliente(e.target.value)}
                placeholder="Ex: 5511986461474@s.whatsapp.net"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Chip <span className="text-destructive">*</span></Label>
              <Select value={tipoSeguro} onValueChange={(v: any) => setTipoSeguro(v)}>
                <SelectTrigger className={!tipoSeguro ? "border-amber-500/50" : ""}>
                  <SelectValue placeholder="Selecione o tipo de chip..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COM SEGURO">CHIP PRO COM SEGURO</SelectItem>
                  <SelectItem value="SEM SEGURO">CHIP PRO SEM SEGURO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted rounded-md text-xs space-y-1">
              <p className="font-medium">Formato da observação automática:</p>
              <p className="text-muted-foreground italic">
                {nomeCliente || '[Cliente]'} - CHIP PRO {tipoSeguro} - {whatsappCliente || '[WhatsApp Cliente]'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVendaOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleConfirmVenda} disabled={!nomeCliente.trim() || !whatsappCliente.trim()}>
              Confirmar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Banido Permanentemente Confirmation Dialog */}
      <Dialog open={confirmBanOpen} onOpenChange={setConfirmBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Confirmar Banimento Permanente
            </DialogTitle>
            <DialogDescription>
              Você confirma que o número <strong>{numero.numero}</strong> foi banido permanentemente? 
              Ele será movido para a aba de restauração.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmBanOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                onDelete('BANIDO PERMANENTEMENTE');
                setConfirmBanOpen(false);
              }}
            >
              Confirmar Banimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Voltar para o estoque Confirmation Dialog */}
      <Dialog
        open={confirmVoltarEstoqueOpen}
        onOpenChange={(v) => {
          setConfirmVoltarEstoqueOpen(v);
          if (v) {
            setVoltarEstoqueModeloId('');
            setVoltarEstoqueTipo('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-600" />
              Retornar ao Estoque
            </DialogTitle>
            <DialogDescription>
              Retornar o número <strong>{numero.numero}</strong> para o estoque: escolha em qual aparelho ele vai ficar.
              As observações do cliente serão limpas e o status muda para "Ativo".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label>Modelo do aparelho *</Label>
            <SearchableSelect
              value={voltarEstoqueModeloId}
              onValueChange={(v) => {
                setVoltarEstoqueModeloId(v);
                const m = modelosList.find((mo) => mo.id === v);
                if (m?.tipo_whatsapp) setVoltarEstoqueTipo(m.tipo_whatsapp);
              }}
              placeholder="Selecione um modelo disponível"
              searchPlaceholder="Buscar modelo…"
              emptyMessage="Nenhum modelo encontrado"
              options={modelosVagasRetorno.map((o) => ({
                value: o.modelo.id,
                label: `${o.modelo.nome}${o.capacidade > 0 ? ` · ${o.ocupados}/${o.capacidade}${o.livres > 0 ? ` · falta ${o.livres}` : ' · cheio'}` : ''}`,
                disabled: o.capacidade > 0 && o.livres <= 0,
              }))}
            />
            <p className="text-[11px] text-muted-foreground">
              Modelos cheios aparecem desabilitados. O modelo escolhido substitui o modelo antigo do número.
            </p>
          </div>

          <div className="space-y-2 py-2">
            <Label>Tipo WhatsApp *</Label>
            <Select
              value={voltarEstoqueTipo}
              onValueChange={(v) => setVoltarEstoqueTipo(v as 'normal' | 'business')}
              disabled={!!modelosList.find((mo) => mo.id === voltarEstoqueModeloId)?.tipo_whatsapp}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">📱 WhatsApp Normal</SelectItem>
                <SelectItem value="business">💼 WhatsApp Business</SelectItem>
              </SelectContent>
            </Select>
            {modelosList.find((mo) => mo.id === voltarEstoqueModeloId)?.tipo_whatsapp && (
              <p className="text-[11px] text-muted-foreground">
                Tipo definido automaticamente pelo modelo selecionado
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmVoltarEstoqueOpen(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleVoltarEstoque}
              disabled={!voltarEstoqueModeloId || !voltarEstoqueTipo}
            >
              Confirmar Retorno
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
  const [capacidade, setCapacidade] = useState(3);
  const [apareceCheckin, setApareceCheckin] = useState(true);
  const [tipoWhatsapp, setTipoWhatsapp] = useState<'' | 'normal' | 'business'>('');

  const handleSubmit = () => {
    if (!nome) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!tipoWhatsapp) {
      toast.error('Selecione o tipo de WhatsApp (Normal ou Business)');
      return;
    }
    if (capacidade < 1 || capacidade > 20) {
      toast.error('Capacidade deve ser entre 1 e 20');
      return;
    }
    onCreate({
      nome,
      marca: marca || undefined,
      descricao: descricao || undefined,
      capacidade_whatsapp: capacidade,
      aparece_no_checkin: apareceCheckin,
      tipo_whatsapp: tipoWhatsapp,
    });
    setOpen(false);
    setNome('');
    setMarca('');
    setDescricao('');
    setCapacidade(3);
    setApareceCheckin(true);
    setTipoWhatsapp('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Novo Modelo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Modelo</DialogTitle>
          <DialogDescription>
            Defina o modelo do aparelho e quantos WhatsApp ele comporta
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Samsung A03, iPhone 15" />
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex: Samsung, Apple" />
          </div>
          <div>
            <Label>Tipo WhatsApp *</Label>
            <Select value={tipoWhatsapp} onValueChange={(v) => setTipoWhatsapp(v as 'normal' | 'business')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">📱 WhatsApp Normal</SelectItem>
                <SelectItem value="business">💼 WhatsApp Business</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Os números cadastrados neste modelo herdam este tipo automaticamente
            </p>
          </div>
          <div>
            <Label>Capacidade de WhatsApp *</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={capacidade}
              onChange={(e) => setCapacidade(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quantos WhatsApp (normal + business) este modelo comporta
            </p>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Aparece no check-in</Label>
              <p className="text-xs text-muted-foreground">
                Se ativo, este modelo aparece na lista de seleção do QR Scan
              </p>
            </div>
            <Switch checked={apareceCheckin} onCheckedChange={setApareceCheckin} />
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
  const [capacidade, setCapacidade] = useState(modelo.capacidade_whatsapp || 3);
  const [apareceCheckin, setApareceCheckin] = useState(modelo.aparece_no_checkin !== false);
  const [tipoWhatsapp, setTipoWhatsapp] = useState<'' | 'normal' | 'business'>(modelo.tipo_whatsapp || '');

  const handleSubmit = () => {
    if (!tipoWhatsapp) {
      toast.error('Selecione o tipo de WhatsApp (Normal ou Business)');
      return;
    }
    if (capacidade < 1 || capacidade > 20) {
      toast.error('Capacidade deve ser entre 1 e 20');
      return;
    }
    onUpdate({
      nome,
      marca: marca || null,
      descricao: descricao || null,
      capacidade_whatsapp: capacidade,
      aparece_no_checkin: apareceCheckin,
      tipo_whatsapp: tipoWhatsapp,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
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
            <Label>Tipo WhatsApp *</Label>
            <Select value={tipoWhatsapp} onValueChange={(v) => setTipoWhatsapp(v as 'normal' | 'business')}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">📱 WhatsApp Normal</SelectItem>
                <SelectItem value="business">💼 WhatsApp Business</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Os números cadastrados neste modelo herdam este tipo automaticamente
            </p>
          </div>
          <div>
            <Label>Capacidade de WhatsApp *</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={capacidade}
              onChange={(e) => setCapacidade(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quantos WhatsApp (normal + business) este modelo comporta
            </p>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Aparece no check-in</Label>
              <p className="text-xs text-muted-foreground">
                Se ativo, este modelo aparece na lista de seleção do QR Scan
              </p>
            </div>
            <Switch checked={apareceCheckin} onCheckedChange={setApareceCheckin} />
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

function DeleteStatusDialog({ 
  status, 
  count, 
  onDelete 
}: { 
  status: NumeroStatus; 
  count: number;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [observacao, setObservacao] = useState('');
  const hasNumbers = count > 0;

  const handleDelete = () => {
    if (hasNumbers) {
      toast.error('Reatribua os números antes de excluir');
      return;
    }
    if (!observacao.trim()) {
      toast.error('Informe o motivo da exclusão');
      return;
    }
    onDelete(status.id);
    setOpen(false);
    setObservacao('');
    toast.success(`Status "${status.nome}" excluído`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {hasNumbers ? 'Exclusão Bloqueada' : 'Excluir Status'}
          </DialogTitle>
          <DialogDescription>
            {hasNumbers ? (
              <span className="block text-destructive">
                Não é possível excluir o status <strong>{status.nome}</strong> porque existem{' '}
                <strong>{count} número{count !== 1 ? 's' : ''}</strong> atribuído{count !== 1 ? 's' : ''} a ele.
                <br /><br />
                Reatribua os números para outro status antes de excluir.
              </span>
            ) : (
              <>Você está prestes a excluir o status <strong>{status.nome}</strong>.</>
            )}
          </DialogDescription>
        </DialogHeader>
        {!hasNumbers && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivo-status" className="text-sm font-medium">
                Motivo da exclusão <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo-status"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informe o motivo da exclusão deste status..."
                className="min-h-[100px]"
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => {
            setOpen(false);
            setObservacao('');
          }}>
            {hasNumbers ? 'Fechar' : 'Cancelar'}
          </Button>
          {!hasNumbers && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={!observacao.trim()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Confirmar Exclusão
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteModeloDialog({ 
  modelo, 
  count, 
  onDelete 
}: { 
  modelo: NumeroModelo; 
  count: number;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [observacao, setObservacao] = useState('');
  const hasNumbers = count > 0;

  const handleDelete = () => {
    if (hasNumbers) {
      toast.error('Reatribua os números antes de excluir');
      return;
    }
    if (!observacao.trim()) {
      toast.error('Informe o motivo da exclusão');
      return;
    }
    onDelete(modelo.id);
    setOpen(false);
    setObservacao('');
    toast.success(`Modelo "${modelo.nome}" excluído`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {hasNumbers ? 'Exclusão Bloqueada' : 'Excluir Modelo'}
          </DialogTitle>
          <DialogDescription>
            {hasNumbers ? (
              <span className="block text-destructive">
                Não é possível excluir o modelo <strong>{modelo.nome}</strong> porque existem{' '}
                <strong>{count} número{count !== 1 ? 's' : ''}</strong> atribuído{count !== 1 ? 's' : ''} a ele.
                <br /><br />
                Reatribua os números para outro modelo antes de excluir.
              </span>
            ) : (
              <>Você está prestes a excluir o modelo <strong>{modelo.nome}</strong>.</>
            )}
          </DialogDescription>
        </DialogHeader>
        {!hasNumbers && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivo-modelo" className="text-sm font-medium">
                Motivo da exclusão <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo-modelo"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informe o motivo da exclusão deste modelo..."
                className="min-h-[100px]"
              />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => {
            setOpen(false);
            setObservacao('');
          }}>
            {hasNumbers ? 'Fechar' : 'Cancelar'}
          </Button>
          {!hasNumbers && (
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={!observacao.trim()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Confirmar Exclusão
            </Button>
          )}
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
            __copyToClipboard(apiKey.api_key);
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
    __copyToClipboard(code);
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
              __copyToClipboard(baseUrl);
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
            <p className="text-muted-foreground text-xs mb-2">Cria um novo número</p>
            <div className="text-xs text-muted-foreground mb-2 space-y-1">
              <p><strong>Campos obrigatórios:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li><code>numero</code> - Número do telefone (ex: +5511999999999)</li>
                <li><code>status_id</code> - UUID do status (obter via GET /status)</li>
                <li><code>modelo_id</code> - UUID do modelo (obter via GET /modelos)</li>
              </ul>
              <p><strong>Campos opcionais:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li><code>observacoes</code> - Observações sobre o número</li>
              </ul>
            </div>
            <CurlBlock code={`curl -X POST -H "x-api-key: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "numero": "+5511999999999",
    "status_id": "UUID_DO_STATUS",
    "modelo_id": "UUID_DO_MODELO",
    "observacoes": "Observação opcional"
  }' \\
  "${baseUrl}"`} />
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-amber-600">PUT</Badge>
              <code>/:id</code>
            </div>
            <p className="text-muted-foreground text-xs mb-2">Atualiza um número existente</p>
            <div className="text-xs text-muted-foreground mb-2 space-y-1">
              <p><strong>Parâmetro na URL:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li><code>:id</code> - UUID do número a ser atualizado</li>
              </ul>
              <p><strong>Campos atualizáveis (todos opcionais):</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li><code>numero</code> - Novo número do telefone</li>
                <li><code>status_id</code> - UUID do novo status</li>
                <li><code>modelo_id</code> - UUID do novo modelo</li>
                <li><code>observacoes</code> - Novas observações</li>
              </ul>
            </div>
            <CurlBlock code={`curl -X PUT -H "x-api-key: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status_id": "UUID_DO_NOVO_STATUS",
    "modelo_id": "UUID_DO_NOVO_MODELO",
    "observacoes": "Atualização de observação"
  }' \\
  "${baseUrl}/UUID_DO_NUMERO"`} />
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-600">DELETE</Badge>
              <code>/:id</code>
            </div>
            <p className="text-muted-foreground text-xs mb-2">Exclui um número</p>
            <div className="text-xs text-muted-foreground mb-2 space-y-1">
              <p><strong>Parâmetro na URL:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li><code>:id</code> - UUID do número a ser excluído</li>
              </ul>
              <p><strong>Campos opcionais no body:</strong></p>
              <ul className="list-disc list-inside ml-2">
                <li><code>observacao</code> - Motivo da exclusão (registrado no histórico)</li>
              </ul>
            </div>
            <CurlBlock code={`curl -X DELETE -H "x-api-key: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "observacao": "Motivo da exclusão do número"
  }' \\
  "${baseUrl}/UUID_DO_NUMERO"`} />
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

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-cyan-600">GET</Badge>
              <code>/modelos</code>
            </div>
            <p className="text-muted-foreground text-xs">Lista todos os modelos disponíveis</p>
            <CurlBlock code={`curl -X GET -H "x-api-key: KEY" \\
  "${baseUrl}/modelos"`} />
          </div>

          <div className="border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-cyan-600">GET</Badge>
              <code>/status</code>
            </div>
            <p className="text-muted-foreground text-xs">Lista todos os status disponíveis</p>
            <CurlBlock code={`curl -X GET -H "x-api-key: KEY" \\
  "${baseUrl}/status"`} />
          </div>
        </div>
      </div>
    </div>
  );
}
