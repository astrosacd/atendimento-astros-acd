import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, RefreshCw, Eye, Download, Filter, X, History } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { exportToCSV } from '@/utils/exportClientes';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClientHistory, ClientHistoryEntry } from '@/hooks/useClientHistory';

export default function ConsultarCliente() {
  const navigate = useNavigate();
  const { searchCliente, fetchClientes, isLoading } = useClientes();
  const { isAdmin } = useAuth();
  const { fetchClientHistory } = useClientHistory();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Cliente[] | null>(null);
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteHistory, setClienteHistory] = useState<ClientHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Advanced filters
  const [filters, setFilters] = useState({
    dataInicio: '',
    dataFim: '',
    valorMin: '',
    valorMax: '',
    produto: '',
    plano: '',
  });

  useEffect(() => {
    loadAllClientes();
  }, []);

  const loadAllClientes = async () => {
    const data = await fetchClientes();
    setAllClientes(data);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let data: Cliente[];
    if (query.trim()) {
      data = await searchCliente(query);
    } else {
      data = allClientes;
    }
    
    // Apply filters
    const filtered = applyFilters(data);
    setResults(filtered);
  };

  const applyFilters = (data: Cliente[]): Cliente[] => {
    return data.filter(cliente => {
      // Date filter
      if (filters.dataInicio) {
        const clienteDate = new Date(cliente.data_renovacao);
        const startDate = new Date(filters.dataInicio);
        if (clienteDate < startDate) return false;
      }
      if (filters.dataFim) {
        const clienteDate = new Date(cliente.data_renovacao);
        const endDate = new Date(filters.dataFim);
        if (clienteDate > endDate) return false;
      }
      
      // Value filter
      if (filters.valorMin && cliente.valor < parseFloat(filters.valorMin)) return false;
      if (filters.valorMax && cliente.valor > parseFloat(filters.valorMax)) return false;
      
      // Product filter
      if (filters.produto && !cliente.produto.toLowerCase().includes(filters.produto.toLowerCase())) return false;
      
      // Plan filter
      if (filters.plano && filters.plano !== 'all' && cliente.plano !== filters.plano) return false;
      
      return true;
    });
  };

  const clearFilters = () => {
    setFilters({
      dataInicio: '',
      dataFim: '',
      valorMin: '',
      valorMax: '',
      produto: '',
      plano: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '' && v !== 'all');

  const resetSearch = () => {
    setQuery('');
    setResults(null);
    clearFilters();
  };

  const handleExport = () => {
    const dataToExport = results || allClientes;
    exportToCSV(dataToExport, 'clientes');
  };

  const handleViewHistory = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setLoadingHistory(true);
    const history = await fetchClientHistory(cliente.id);
    setClienteHistory(history);
    setLoadingHistory(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Cadastrado';
      case 'updated': return 'Atualizado';
      case 'deleted': return 'Excluído';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'text-primary';
      case 'updated': return 'text-update';
      case 'deleted': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  // Get unique products and plans for filter dropdowns
  const uniqueProducts = [...new Set(allClientes.map(c => c.produto))];
  const uniquePlans = [...new Set(allClientes.map(c => c.plano).filter(Boolean))];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl bg-card border-border card-glow">
          <CardHeader className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-info/10 glow-blue">
                  <Eye className="w-6 h-6 text-info" />
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  Consulta de Cliente
                </CardTitle>
              </div>
              <div className="flex gap-2">
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className={`border-border ${hasActiveFilters ? 'border-info text-info' : ''}`}
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="bg-card border-border">
                    <SheetHeader>
                      <SheetTitle className="text-foreground font-display">Filtros Avançados</SheetTitle>
                      <SheetDescription className="text-muted-foreground">
                        Refine sua busca com filtros específicos
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label className="text-foreground">Período de Renovação</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={filters.dataInicio}
                            onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                            className="bg-secondary border-border text-foreground"
                            placeholder="De"
                          />
                          <Input
                            type="date"
                            value={filters.dataFim}
                            onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                            className="bg-secondary border-border text-foreground"
                            placeholder="Até"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground">Faixa de Valor</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            value={filters.valorMin}
                            onChange={(e) => setFilters({ ...filters, valorMin: e.target.value })}
                            className="bg-secondary border-border text-foreground"
                            placeholder="Mínimo"
                          />
                          <Input
                            type="number"
                            value={filters.valorMax}
                            onChange={(e) => setFilters({ ...filters, valorMax: e.target.value })}
                            className="bg-secondary border-border text-foreground"
                            placeholder="Máximo"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground">Produto</Label>
                        <Select
                          value={filters.produto}
                          onValueChange={(value) => setFilters({ ...filters, produto: value })}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground">
                            <SelectValue placeholder="Todos os produtos" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="all">Todos os produtos</SelectItem>
                            {uniqueProducts.map((produto) => (
                              <SelectItem key={produto} value={produto}>{produto}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground">Plano</Label>
                        <Select
                          value={filters.plano}
                          onValueChange={(value) => setFilters({ ...filters, plano: value })}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground">
                            <SelectValue placeholder="Todos os planos" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="all">Todos os planos</SelectItem>
                            {uniquePlans.map((plano) => (
                              <SelectItem key={plano} value={plano!}>{plano}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button 
                          onClick={() => {
                            setShowFilters(false);
                            if (results) {
                              const filtered = applyFilters(results);
                              setResults(filtered);
                            }
                          }}
                          className="flex-1 bg-info text-info-foreground hover:bg-info/90 btn-3d"
                        >
                          Aplicar Filtros
                        </Button>
                        <Button 
                          onClick={clearFilters}
                          variant="outline"
                          className="border-border text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
                
                {(results || allClientes.length > 0) && (
                  <Button
                    onClick={handleExport}
                    variant="outline"
                    size="icon"
                    className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    title="Exportar CSV"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!results ? (
              <form onSubmit={handleSearch} className="space-y-4">
                <Input
                  placeholder="Digite o CPF, CNPJ, número ou nome (deixe vazio para listar todos)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="bg-secondary border-border text-foreground h-12"
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-info text-info-foreground hover:bg-info/90 font-semibold btn-3d glow-blue"
                  disabled={isLoading}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? 'Consultando...' : 'Consultar'}
                </Button>
                <Button 
                  type="button"
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full border-border text-muted-foreground hover:bg-secondary h-12"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Menu
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-info font-display">
                    {results.length > 0 ? `${results.length} cliente(s) encontrado(s)` : 'Nenhum cliente encontrado'}
                  </h2>
                  {hasActiveFilters && (
                    <span className="text-xs bg-info/10 text-info px-2 py-1 rounded-full">
                      Filtros ativos
                    </span>
                  )}
                </div>
                
                {results.length > 0 ? (
                  <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {results.map((cliente) => (
                      <div 
                        key={cliente.id}
                        className="bg-info/5 border border-info/20 rounded-xl p-5 space-y-3 animate-fade-in hover:border-info/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-info capitalize font-display">{cliente.nome}</h3>
                          {isAdmin && (
                            <Button
                              onClick={() => handleViewHistory(cliente)}
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-info"
                              title="Ver histórico"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <p className="text-muted-foreground">ID: <span className="text-foreground">{cliente.id.slice(0, 8)}...</span></p>
                          <p className="text-muted-foreground">Telefone: <span className="text-foreground">{cliente.numero}</span></p>
                          <p className="text-muted-foreground">Email: <span className="text-foreground">{cliente.email}</span></p>
                          <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{cliente.cpf}</span></p>
                          <p className="text-muted-foreground">Produto: <span className="text-foreground">{cliente.produto}</span></p>
                          <p className="text-muted-foreground">Plano: <span className="text-foreground">{cliente.plano || 'Nenhum'}</span></p>
                          <p className="text-muted-foreground">Valor: <span className="text-primary font-medium">{formatCurrency(cliente.valor)}</span></p>
                          <p className="text-muted-foreground">Renovação: <span className="text-info font-medium">{formatDate(cliente.data_renovacao)}</span></p>
                        </div>
                        {cliente.observacao && (
                          <div className="pt-2 border-t border-info/10">
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Obs:</span> {cliente.observacao}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-destructive">
                    Nenhum cliente encontrado com os dados informados.
                  </p>
                )}

                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={resetSearch}
                    className="bg-info text-info-foreground hover:bg-info/90 h-11 btn-3d"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Nova Consulta
                  </Button>
                  <Button 
                    onClick={() => navigate('/')}
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-secondary h-11"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar ao Menu
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Dialog */}
        <Dialog open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground font-display flex items-center gap-2">
                <History className="h-5 w-5 text-info" />
                Histórico de Alterações
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedCliente?.nome}
              </DialogDescription>
            </DialogHeader>
            
            {loadingHistory ? (
              <div className="py-8 text-center text-muted-foreground">Carregando...</div>
            ) : clienteHistory.length > 0 ? (
              <div className="space-y-3 mt-4">
                {clienteHistory.map((entry) => (
                  <div 
                    key={entry.id}
                    className="bg-secondary/50 border border-border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-medium ${getActionColor(entry.action)}`}>
                        {getActionLabel(entry.action)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Por: {entry.changed_by_email || 'Sistema'}
                    </p>
                    {entry.changed_fields && entry.changed_fields.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Campos alterados: {entry.changed_fields.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum histórico encontrado
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
