import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Wallet, TrendingDown, CheckCircle2, Clock, AlertTriangle, 
  Search, Filter, Calendar, ArrowLeft, Settings, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDespesas } from '@/hooks/useDespesas';
import { DespesasTable } from '@/components/despesas/DespesasTable';
import { DespesaFormDialog } from '@/components/despesas/DespesaFormDialog';
import { CategoriasManager } from '@/components/despesas/CategoriasManager';
import { FinancialSummaryCard } from '@/components/despesas/FinancialSummaryCard';
import { DespesasCronStatus } from '@/components/despesas/DespesasCronStatus';

export default function Despesas() {
  const navigate = useNavigate();
  const { 
    despesas, 
    categorias, 
    isLoading, 
    stats,
    createDespesa,
    updateDespesa,
    deleteDespesa,
    markAsPaid,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    generateRecurringExpenses,
    fetchDespesas,
  } = useDespesas();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<any>(null);
  const [isCategoriasOpen, setIsCategoriasOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyUsd = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const filteredDespesas = despesas.filter(d => {
    const matchesSearch = d.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.categoria?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEdit = (despesa: any) => {
    setEditingDespesa(despesa);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingDespesa(null);
  };

  const handleGenerateRecurring = async () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    await generateRecurringExpenses(nextMonth);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-gradient">
                Despesas
              </h1>
              <p className="text-muted-foreground text-sm">
                Gerencie as despesas e custos da empresa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCategoriasOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Categorias
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateRecurring}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Gerar Recorrentes
            </Button>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </div>
        </div>

        {/* Cron Status */}
        <DespesasCronStatus />

        {/* Resumo Financeiro */}
        <FinancialSummaryCard stats={stats} />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalDespesasMes)}</p>
                  <p className="text-xs text-muted-foreground">Despesas do Mês</p>
                  {stats.totalDespesasMesUsd > 0 && (
                    <p className="text-xs text-muted-foreground">{formatCurrencyUsd(stats.totalDespesasMesUsd)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.despesasPagas}</p>
                  <p className="text-xs text-muted-foreground">Pagas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.despesasPendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.despesasAtrasadas}</p>
                  <p className="text-xs text-muted-foreground">Atrasadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por descrição ou categoria..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="all">Todas</TabsTrigger>
                  <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                  <TabsTrigger value="pago">Pagas</TabsTrigger>
                  <TabsTrigger value="atrasado">Atrasadas</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <DespesasTable 
          despesas={filteredDespesas}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={deleteDespesa}
          onMarkAsPaid={markAsPaid}
        />

        {/* Form Dialog */}
        <DespesaFormDialog 
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          categorias={categorias}
          editingDespesa={editingDespesa}
          onSubmit={editingDespesa ? 
            (data) => updateDespesa(editingDespesa.id, data) : 
            createDespesa
          }
        />

        {/* Categorias Manager */}
        <CategoriasManager
          isOpen={isCategoriasOpen}
          onClose={() => setIsCategoriasOpen(false)}
          categorias={categorias}
          onCreate={createCategoria}
          onUpdate={updateCategoria}
          onDelete={deleteCategoria}
        />
      </div>
    </DashboardLayout>
  );
}
