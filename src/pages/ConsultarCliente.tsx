import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, RefreshCw, Eye, Download, Filter, X, History, Tag, CreditCard, File, AlertTriangle, ShoppingBag, Clock, ListTree, Lock, Edit, Users, Sparkles, Network } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { exportToCSV } from '@/utils/exportClientes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCPFOrCNPJ, formatPhone } from '@/utils/formatters';
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
import { Badge } from '@/components/ui/badge';
import { ClientPaymentHistory } from '@/components/ClientPaymentHistory';
import { ClientFilesManager } from '@/components/ClientFilesManager';
import { ClientPurchasesManager } from '@/components/ClientPurchasesManager';
import { useTranslation } from 'react-i18next';
import { ClientUnifiedTimeline } from '@/components/ClientUnifiedTimeline';
import { ClientConnectionGraph } from '@/components/ClientConnectionGraph';
import { ClientAIInsights } from '@/components/ClientAIInsights';
import { ClientSocialCredentials } from '@/components/ClientSocialCredentials';
import { CreateWhatsAppGroupDialog } from '@/components/CreateWhatsAppGroupDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';

export default function ConsultarCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { searchCliente, fetchClientes, updateCliente, isLoading } = useClientes();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { fetchClientHistory } = useClientHistory();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Cliente[] | null>(null);
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteHistory, setClienteHistory] = useState<ClientHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [paymentClienteId, setPaymentClienteId] = useState<string | null>(null);
  const [paymentClienteName, setPaymentClienteName] = useState<string>('');
  const [filesClienteId, setFilesClienteId] = useState<string | null>(null);
  const [filesClienteName, setFilesClienteName] = useState<string>('');
  const [purchasesClienteId, setPurchasesClienteId] = useState<string | null>(null);
  const [purchasesClienteName, setPurchasesClienteName] = useState<string>('');
  const [timelineClienteId, setTimelineClienteId] = useState<string | null>(null);
  const [timelineClienteName, setTimelineClienteName] = useState<string>('');
  const [graphClienteId, setGraphClienteId] = useState<string | null>(null);
  const [graphClienteName, setGraphClienteName] = useState<string>('');
  const [aiClienteId, setAiClienteId] = useState<string | null>(null);
  const [aiClienteName, setAiClienteName] = useState<string>('');
  const [socialClienteId, setSocialClienteId] = useState<string | null>(null);
  const [socialClienteName, setSocialClienteName] = useState<string>('');
  const [groupClienteId, setGroupClienteId] = useState<string | null>(null);
  const [groupClienteName, setGroupClienteName] = useState<string>('');
  const [groupClienteNumero, setGroupClienteNumero] = useState<string>('');
  const { canViewSocialCredentials, canCreateWhatsAppGroups, canViewClientAI } = usePermissions();
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filterInadimplente, setFilterInadimplente] = useState(false);
  const [filterRenovacaoProxima, setFilterRenovacaoProxima] = useState(false);
  
  // Quick edit state
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editNumero, setEditNumero] = useState('');
  const [editProduto, setEditProduto] = useState('');
  const [editObservacao, setEditObservacao] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Advanced filters
  const [filters, setFilters] = useState({
    dataInicio: '',
    dataFim: '',
    valorMin: '',
    valorMax: '',
    produto: '',
    plano: '',
    tag: '',
    tipoCliente: '',
  });

  useEffect(() => {
    loadAllClientes();
    loadAvailableTags();
    
    // Check URL params for filters
    const filter = searchParams.get('filter');
    if (filter === 'inadimplente') {
      setFilterInadimplente(true);
      setFilters(prev => ({ ...prev, tipoCliente: 'inadimplente' }));
    } else if (filter === 'registro-sem-valor') {
      setFilters(prev => ({ ...prev, tipoCliente: 'registro-sem-valor' }));
    } else if (filter === 'renovacao-proxima') {
      setFilterRenovacaoProxima(true);
      setFilters(prev => ({ ...prev, tipoCliente: 'renovacao-proxima' }));
    }
  }, [searchParams]);

  const loadAllClientes = async () => {
    const data = await fetchClientes();
    setAllClientes(data);
    
    // If inadimplente filter is active, auto-filter results
    const filter = searchParams.get('filter');
    if (filter === 'inadimplente') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filtered = data.filter(cliente => {
        if (!cliente.cobranca_ativa) return false; // Only active billing clients
        const renewalDate = new Date(cliente.data_renovacao);
        return renewalDate < today;
      });
      setResults(filtered);
    } else if (filter === 'registro-sem-valor') {
      // Filter registro clients without value
      const filtered = data.filter(cliente => {
        return cliente.cobranca_ativa === false && (!cliente.valor || cliente.valor === 0);
      });
      setResults(filtered);
    } else if (filter === 'renovacao-proxima') {
      // Filter clients with renewal in next 7 days - timezone-safe string comparison
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const nextWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
      const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;
      const filtered = data.filter(cliente => {
        if (!cliente.data_renovacao) return false;
        const renovacaoStr = String(cliente.data_renovacao).slice(0, 10);
        return renovacaoStr >= todayStr && renovacaoStr <= nextWeekStr;
      });
      setResults(filtered);
    }
  };

  const loadAvailableTags = async () => {
    const { data } = await supabase
      .from('billing_config')
      .select('config_value')
      .like('config_key', 'tag_%');
    if (data) {
      setAvailableTags(data.map(d => d.config_value).filter(Boolean));
    }
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
      // Inadimplente filter (overdue clients)
      if (filterInadimplente) {
        if (!cliente.cobranca_ativa) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const renewalDate = new Date(cliente.data_renovacao);
        if (renewalDate >= today) return false;
      }
      
      // Renovação próxima filter (clients renewing in next 7 days) - timezone-safe
      if (filterRenovacaoProxima) {
        if (!cliente.data_renovacao) return false;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const nextWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
        const nextWeekStr = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;
        const renovacaoStr = String(cliente.data_renovacao).slice(0, 10);
        if (renovacaoStr < todayStr || renovacaoStr > nextWeekStr) return false;
      }
      
      // Client type filter
      if (filters.tipoCliente && filters.tipoCliente !== 'all') {
        if (filters.tipoCliente === 'mensal' && cliente.cobranca_ativa === false) return false;
        if (filters.tipoCliente === 'registro' && cliente.cobranca_ativa !== false) return false;
      }
      
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
      if (filters.produto && filters.produto !== 'all' && !cliente.produto.toLowerCase().includes(filters.produto.toLowerCase())) return false;
      
      // Plan filter
      if (filters.plano && filters.plano !== 'all' && cliente.plano !== filters.plano) return false;
      
      // Tag filter
      if (filters.tag && filters.tag !== 'all') {
        if (!cliente.tags?.some(t => t.toLowerCase() === filters.tag.toLowerCase())) return false;
      }
      
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
      tag: '',
      tipoCliente: '',
    });
    setFilterInadimplente(false);
    setFilterRenovacaoProxima(false);
    // Remove URL param
    navigate('/consultar', { replace: true });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '' && v !== 'all') || filterInadimplente || filterRenovacaoProxima;

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

  // Refresh a specific client's data in the results list
  const refreshClienteData = async (clienteId: string) => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();
    
    if (data) {
      // Update in results
      setResults(prev => prev ? prev.map(c => c.id === clienteId ? data as Cliente : c) : null);
      // Update in allClientes
      setAllClientes(prev => prev.map(c => c.id === clienteId ? data as Cliente : c));
    }
  };

  // Quick edit handlers
  const handleOpenEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setEditEmail(cliente.email || '');
    setEditNumero(cliente.numero || '');
    setEditProduto(cliente.produto || '');
    setEditObservacao(cliente.observacao || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCliente) return;
    setIsSavingEdit(true);
    
    const updates: Partial<any> = {};
    if (editEmail !== editingCliente.email) updates.email = editEmail;
    if (editNumero !== editingCliente.numero) updates.numero = editNumero;
    if (editProduto !== editingCliente.produto) updates.produto = editProduto;
    if (editObservacao !== (editingCliente.observacao || '')) updates.observacao = editObservacao;
    
    if (Object.keys(updates).length === 0) {
      toast({ title: 'Nenhuma alteração detectada' });
      setIsSavingEdit(false);
      return;
    }
    
    const result = await updateCliente(editingCliente.id, updates, editingCliente);
    if (result) {
      await refreshClienteData(editingCliente.id);
      setEditingCliente(null);
    }
    setIsSavingEdit(false);
  };

  const formatDate = (dateString: string) => {
    // Adiciona horário meio-dia para evitar problema de timezone
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number, moeda: string = 'BRL') => {
    if (moeda === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return t('clients.created');
      case 'updated': return t('clients.updated');
      case 'deleted': return t('clients.deleted');
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
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-info/10 glow-blue">
                  <Eye className="w-6 h-6 text-info" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <CardTitle className="text-2xl sm:text-3xl font-bold font-display text-foreground text-center">
                  {t('clients.search.title')}
                </CardTitle>
                {filterInadimplente && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {t('dashboard.overduedClients')}
                  </Badge>
                )}
                {filterRenovacaoProxima && (
                  <Badge variant="outline" className="text-xs border-update text-update">
                    <Clock className="w-3 h-3 mr-1" />
                    {t('dashboard.upcomingRenewals')} (7 dias)
                  </Badge>
                )}
              </div>

              <div className="flex gap-2 justify-end">
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
                  <SheetContent className="bg-card border-border flex flex-col h-full p-6">
                    <SheetHeader className="flex-shrink-0 mb-4">
                      <SheetTitle className="text-foreground font-display">{t('clients.advancedFilters')}</SheetTitle>
                      <SheetDescription className="text-muted-foreground">
                        {t('clients.refineSearch')}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto overflow-x-visible space-y-5 px-1 pr-3">
                      <div className="space-y-2">
                        <Label className="text-foreground">{t('clients.renewalPeriod')}</Label>
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
                        <Label className="text-foreground">{t('clients.valueRange')}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            value={filters.valorMin}
                            onChange={(e) => setFilters({ ...filters, valorMin: e.target.value })}
                            className="bg-secondary border-border text-foreground"
                            placeholder={t('clients.minimum')}
                          />
                          <Input
                            type="number"
                            value={filters.valorMax}
                            onChange={(e) => setFilters({ ...filters, valorMax: e.target.value })}
                            className="bg-secondary border-border text-foreground"
                            placeholder={t('clients.maximum')}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground">{t('clients.product')}</Label>
                        <Select
                          value={filters.produto}
                          onValueChange={(value) => setFilters({ ...filters, produto: value })}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground">
                            <SelectValue placeholder={t('clients.allProducts')} />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="all">{t('clients.allProducts')}</SelectItem>
                            {uniqueProducts.map((produto) => (
                              <SelectItem key={produto} value={produto}>{produto}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-foreground">{t('clients.plan')}</Label>
                        <Select
                          value={filters.plano}
                          onValueChange={(value) => setFilters({ ...filters, plano: value })}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground">
                            <SelectValue placeholder={t('clients.allPlans')} />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="all">{t('clients.allPlans')}</SelectItem>
                            {uniquePlans.map((plano) => (
                              <SelectItem key={plano} value={plano!}>{plano}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground">{t('clients.tags')}</Label>
                        <Select
                          value={filters.tag}
                          onValueChange={(value) => setFilters({ ...filters, tag: value })}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground">
                            <SelectValue placeholder={t('clients.allTags')} />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="all">{t('clients.allTags')}</SelectItem>
                            {availableTags.map((tag) => (
                              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground">{t('clients.clientType')}</Label>
                        <Select
                          value={filters.tipoCliente}
                          onValueChange={(value) => {
                            setFilters({ ...filters, tipoCliente: value });
                            // If selecting inadimplente, also set the flag
                            if (value === 'inadimplente') {
                              setFilterInadimplente(true);
                            } else {
                              setFilterInadimplente(false);
                            }
                          }}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground">
                            <SelectValue placeholder={t('clients.allTypes')} />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="all">{t('clients.allTypes')}</SelectItem>
                            <SelectItem value="mensal">{t('clients.monthly')}</SelectItem>
                            <SelectItem value="registro">{t('clients.registrationOnly')}</SelectItem>
                            <SelectItem value="inadimplente" className="text-destructive">{t('dashboard.overduedClients')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button 
                          onClick={() => {
                            setShowFilters(false);
                            // Always filter from original data (allClientes or search results)
                            const baseData = query.trim() ? allClientes.filter(c => 
                              c.cpf.includes(query) || 
                              c.numero.includes(query) || 
                              c.nome.toLowerCase().includes(query.toLowerCase()) ||
                              c.email.toLowerCase().includes(query.toLowerCase())
                            ) : allClientes;
                            const filtered = applyFilters(baseData);
                            setResults(filtered);
                          }}
                          className="flex-1 bg-info text-info-foreground hover:bg-info/90 btn-3d"
                        >
                          {t('common.apply')}
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
                    title={t('common.export')}
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
                  placeholder={t('clients.searchPlaceholder')}
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
                  {isLoading ? t('common.loading') : t('common.search')}
                </Button>
                <Button 
                  type="button"
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full border-border text-muted-foreground hover:bg-secondary h-12"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('common.back')}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-info font-display">
                    {results.length > 0 ? `${results.length} ${t('clients.clientsFound')}` : t('clients.noClientsFound')}
                  </h2>
                  {hasActiveFilters && (
                    <span className="text-xs bg-info/10 text-info px-2 py-1 rounded-full">
                      {t('clients.filtersActive')}
                    </span>
                  )}
                </div>
                
                {results.length > 0 ? (
                  <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {results.map((cliente) => (
                      <div 
                        key={cliente.id}
                        className={`border rounded-xl p-5 space-y-3 animate-fade-in transition-colors ${
                          cliente.cobranca_ativa === false 
                            ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' 
                            : 'bg-info/5 border-info/20 hover:border-info/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h3 className={`text-lg font-semibold capitalize font-display ${
                              cliente.cobranca_ativa === false ? 'text-amber-500' : 'text-info'
                            }`}>{cliente.nome}</h3>
                            {cliente.cobranca_ativa === false && (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
                                {t('clients.registrationOnly')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {/* Quick edit button */}
                            {isAdmin && (
                              <Button
                                onClick={() => handleOpenEdit(cliente)}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-update"
                                title="Editar cliente"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {/* Files button - only for Registro clients */}
                            {cliente.cobranca_ativa === false && (
                              <Button
                                onClick={() => {
                                  setFilesClienteId(cliente.id);
                                  setFilesClienteName(cliente.nome);
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-amber-500"
                                title="Ver arquivos"
                              >
                                <File className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <>
                                {/* Payment button - only for Mensal clients */}
                                {cliente.cobranca_ativa !== false && (
                                  <Button
                                    onClick={() => {
                                      setPaymentClienteId(cliente.id);
                                      setPaymentClienteName(cliente.nome);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-300"
                                    title="Ver pagamentos"
                                  >
                                    <CreditCard className="h-4 w-4" />
                                  </Button>
                                )}
                                {/* Purchases button - only for Registro clients */}
                                {cliente.cobranca_ativa === false && (
                                  <Button
                                    onClick={() => {
                                      setPurchasesClienteId(cliente.id);
                                      setPurchasesClienteName(cliente.nome);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-amber-500"
                                    title="Ver histórico de compras"
                                  >
                                    <ShoppingBag className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleViewHistory(cliente)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-info"
                                  title="Ver histórico"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => {
                                    setTimelineClienteId(cliente.id);
                                    setTimelineClienteName(cliente.nome);
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-violet-500"
                                  title="Timeline completa"
                                >
                                  <ListTree className="h-4 w-4" />
                                </Button>
                                {canViewClientAI() && (
                                  <Button
                                    onClick={() => {
                                      setAiClienteId(cliente.id);
                                      setAiClienteName(cliente.nome);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-amber-500"
                                    title="Insights de IA (Briefing & Churn)"
                                  >
                                    <Sparkles className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            {canViewSocialCredentials() && (
                              <Button
                                onClick={() => {
                                  setSocialClienteId(cliente.id);
                                  setSocialClienteName(cliente.nome);
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-pink-500"
                                title="Credenciais Social Media"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                            {(isAdmin || canCreateWhatsAppGroups()) && (
                              <Button
                                onClick={() => {
                                  setGroupClienteId(cliente.id);
                                  setGroupClienteName(cliente.nome);
                                  setGroupClienteNumero(cliente.numero);
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-300"
                                title="Criar Grupo WhatsApp"
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <p className="text-muted-foreground">ID: <span className="text-foreground">{cliente.id.slice(0, 8)}...</span></p>
                          <p className="text-muted-foreground">{t('clients.phone')}: <span className="text-foreground">{formatPhone(cliente.numero)}</span></p>
                          <p className="text-muted-foreground">{t('clients.email')}: <span className="text-foreground">{cliente.email}</span></p>
                          <p className="text-muted-foreground">{t('clients.cpfCnpj')}: <span className="text-foreground">{formatCPFOrCNPJ(cliente.cpf)}</span></p>
                          <p className="text-muted-foreground">{t('clients.product')}: <span className="text-foreground">{cliente.produto}</span></p>
                          {cliente.cobranca_ativa !== false ? (
                            <>
                              <p className="text-muted-foreground">{t('clients.plan')}: <span className="text-foreground">{cliente.plano || t('common.none')}</span></p>
                              <p className="text-muted-foreground">{t('clients.value')}: <span className="text-primary font-medium">{formatCurrency(cliente.valor, cliente.moeda)}</span></p>
                              <p className="text-muted-foreground">{t('clients.renewalDate')}: <span className="text-info font-medium">{formatDate(cliente.data_renovacao)}</span></p>
                            </>
                          ) : (
                            <>
                              {cliente.valor > 0 && (
                                <p className="text-muted-foreground">Valor Pago: <span className="text-amber-500 font-medium">{formatCurrency(cliente.valor, cliente.moeda)}</span></p>
                              )}
                            </>
                          )}
                        </div>
                        {cliente.tags && cliente.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2">
                            {cliente.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                <Tag className="w-2.5 h-2.5 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {cliente.observacao && (
                          <div className="pt-2 border-t border-info/10">
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">{t('clients.observations')}:</span> {cliente.observacao}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-destructive">
                    {t('clients.tryDifferentSearch')}
                  </p>
                )}

                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={resetSearch}
                    className="bg-info text-info-foreground hover:bg-info/90 h-11 btn-3d"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('clients.newSearch')}
                  </Button>
                  <Button 
                    onClick={() => navigate('/')}
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-secondary h-11"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('common.back')}
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
                {t('clients.clientHistory')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedCliente?.nome}
              </DialogDescription>
            </DialogHeader>
            
            {loadingHistory ? (
              <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>
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
                      {t('clients.changedBy')}: {entry.changed_by_email || t('common.system')}
                    </p>
                    {entry.changed_fields && entry.changed_fields.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('clients.changedFields')}: {entry.changed_fields.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                {t('clients.noHistoryFound')}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment History Dialog */}
        <ClientPaymentHistory
          clienteId={paymentClienteId || ''}
          clienteName={paymentClienteName}
          isOpen={!!paymentClienteId}
          onClose={() => setPaymentClienteId(null)}
          onPaymentUpdate={() => paymentClienteId && refreshClienteData(paymentClienteId)}
        />

        {/* Files Dialog */}
        <Dialog open={!!filesClienteId} onOpenChange={() => setFilesClienteId(null)}>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground font-display flex items-center gap-2">
                <File className="h-5 w-5 text-amber-500" />
                {t('files.title')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {filesClienteName}
              </DialogDescription>
            </DialogHeader>
            {filesClienteId && (
              <ClientFilesManager clienteId={filesClienteId} readOnly={!isAdmin} />
            )}
          </DialogContent>
        </Dialog>

        {/* Purchases History Dialog - for Registro clients */}
        <Dialog open={!!purchasesClienteId} onOpenChange={() => setPurchasesClienteId(null)}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground font-display flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-500" />
                Histórico de Compras
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {purchasesClienteName}
              </DialogDescription>
            </DialogHeader>
            {purchasesClienteId && (
              <ClientPurchasesManager clienteId={purchasesClienteId} clienteNome={purchasesClienteName} />
            )}
          </DialogContent>
        </Dialog>

        {/* Unified Timeline Dialog */}
        <Dialog open={!!timelineClienteId} onOpenChange={() => setTimelineClienteId(null)}>
          <DialogContent className="!bg-card border border-border max-w-2xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-lg shadow-2xl z-[60]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-foreground font-display flex items-center gap-2">
                <ListTree className="h-5 w-5 text-violet-500" />
                Timeline Completa
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Todos os eventos de {timelineClienteName}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
              {timelineClienteId && (
                <ClientUnifiedTimeline clienteId={timelineClienteId} clienteName={timelineClienteName} />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Insights Dialog */}
        <Dialog open={!!aiClienteId} onOpenChange={() => setAiClienteId(null)}>
          <DialogContent className="!bg-card border border-border max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-lg shadow-2xl z-[60]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Insights de IA</DialogTitle>
              <DialogDescription>
                Briefing automático para reuniões e análise de risco de churn
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
              {aiClienteId && (
                <ClientAIInsights clienteId={aiClienteId} clienteName={aiClienteName} />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Quick Edit Dialog */}
        <Dialog open={!!editingCliente} onOpenChange={() => setEditingCliente(null)}>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground font-display flex items-center gap-2">
                <Edit className="h-5 w-5 text-update" />
                Editar Cliente
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingCliente?.nome} — {editingCliente?.produto}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-foreground font-medium">E-mail</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="bg-secondary border-border text-foreground h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-medium">{t('clients.phone')}</Label>
                <Input
                  placeholder="5511999999999"
                  value={editNumero}
                  onChange={(e) => setEditNumero(e.target.value)}
                  className="bg-secondary border-border text-foreground h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-medium">{t('clients.product')}</Label>
                <Input
                  placeholder="Nome do produto"
                  value={editProduto}
                  onChange={(e) => setEditProduto(e.target.value)}
                  className="bg-secondary border-border text-foreground h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground font-medium">{t('clients.observations')}</Label>
                <Input
                  placeholder="Observações"
                  value={editObservacao}
                  onChange={(e) => setEditObservacao(e.target.value)}
                  className="bg-secondary border-border text-foreground h-10"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="flex-1 bg-update text-update-foreground hover:bg-update/90"
                >
                  {isSavingEdit ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button
                  onClick={() => setEditingCliente(null)}
                  variant="outline"
                  className="border-border"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Social Media Credentials */}
        <ClientSocialCredentials
          clienteId={socialClienteId || ''}
          clienteName={socialClienteName}
          open={!!socialClienteId}
          onOpenChange={() => setSocialClienteId(null)}
        />

        {/* WhatsApp Group Creation */}
        <CreateWhatsAppGroupDialog
          clienteId={groupClienteId || ''}
          clienteName={groupClienteName}
          clienteNumero={groupClienteNumero}
          open={!!groupClienteId}
          onOpenChange={() => setGroupClienteId(null)}
        />
      </div>
    </DashboardLayout>
  );
}
