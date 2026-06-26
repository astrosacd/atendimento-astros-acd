import { useState, useEffect } from 'react';
import { useSystemActivities } from '@/hooks/useSystemActivities';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClientes, Cliente, CicloCobranca, Moeda } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Check, RefreshCw, FileText, Repeat, DollarSign, Phone, Store, AlertCircle, Mail, ShieldCheck, Package, Eye, Calendar, TrendingUp, Globe } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TagInput } from '@/components/TagInput';
import { ClientFilesManager } from '@/components/ClientFilesManager';
import { ClientLicensesManager } from '@/components/ClientLicensesManager';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrencyInput, parseCurrency, formatCurrencyDisplay } from '@/utils/formatters';
import { PhoneInputWithCountry } from '@/components/PhoneInputWithCountry';
import { ProductSelector } from '@/components/kanban/ProductSelector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from 'react-i18next';
import { isInternationalPhoneNumber } from '@/utils/phoneInternational';

export default function AtualizarCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { logActivity } = useSystemActivities();
  const { searchCliente, updateCliente, isLoading } = useClientes();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newObservacao, setNewObservacao] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newCicloCobranca, setNewCicloCobranca] = useState<CicloCobranca>('mensal');
  const [newMoeda, setNewMoeda] = useState<Moeda>('BRL');
  const [newNumero, setNewNumero] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('BR');
  const [newValor, setNewValor] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEditProduto, setNewEditProduto] = useState('');
  const [newCpf, setNewCpf] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [newTipo, setNewTipo] = useState('cliente');
  const [newExcluirMetricas, setNewExcluirMetricas] = useState(false);
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availablePlanos, setAvailablePlanos] = useState<{ id: string; nome: string }[]>([]);
  const [newPlano, setNewPlano] = useState<string | null>(null);
  const [isOriginallyReseller, setIsOriginallyReseller] = useState(false);

  const normalizePlano = (plano?: string | null) => {
    if (!plano) return 'Individual';
    const cleaned = plano.trim();
    if (!cleaned) return 'Individual';
    if (cleaned.toLowerCase() === 'none') return 'Individual';
    if (cleaned.toLowerCase() === 'nenhum') return 'Individual';
    return cleaned;
  };

  useEffect(() => {
    loadAvailableTags();
    loadAvailablePlanos();
  }, []);

  const loadAvailablePlanos = async () => {
    const { data } = await supabase
      .from('planos_revendedor')
      .select('id, nome')
      .eq('is_active', true)
      .order('nome');
    if (data) {
      setAvailablePlanos(data);
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
    if (!searchQuery.trim()) return;
    
    const results = await searchCliente(searchQuery);
    setSearchResults(results);
    setSearchPerformed(true);
  };

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      const loadCliente = async () => {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .single();
        if (data) {
          handleSelectCliente(data as Cliente);
        }
      };
      loadCliente();
    }
  }, [searchParams]);

  const handleSelectCliente = (cliente: Cliente) => {
    const planoNormalizado = normalizePlano(cliente.plano);
    const clienteIsReseller = planoNormalizado !== 'Individual';

    setSelectedCliente(cliente);
    setNewDate(cliente.data_renovacao);
    setNewObservacao(cliente.observacao || '');
    setNewTags(cliente.tags || []);
    setNewCicloCobranca(cliente.ciclo_cobranca || 'mensal');
    setNewMoeda(cliente.moeda || 'BRL');
    setNewEditProduto(cliente.produto || '');
    setNewNumero(cliente.numero || '');
    setNewEmail(cliente.email || '');
    setNewCpf(cliente.cpf || '');
    setNewPlano(planoNormalizado || 'Individual');
    setIsOriginallyReseller(clienteIsReseller);
    setNewTipo(cliente.tipo || 'cliente');
    setNewExcluirMetricas(cliente.excluir_metricas || false);
    // Try to detect country code from the number
    const detectedCountry = detectCountryFromNumber(cliente.numero || '');
    setNewCountryCode(detectedCountry);
    setNewValor(formatCurrencyDisplay(cliente.valor || 0, cliente.moeda || 'BRL'));
    setSearchResults([]);
  };

  // Helper function to detect country code from phone number
  const detectCountryFromNumber = (numero: string): string => {
    if (!numero) return 'BR';
    // Common DDIs
    if (numero.startsWith('55')) return 'BR';
    if (numero.startsWith('1') && numero.length >= 11) return 'US';
    if (numero.startsWith('351')) return 'PT';
    if (numero.startsWith('34')) return 'ES';
    if (numero.startsWith('54')) return 'AR';
    if (numero.startsWith('52')) return 'MX';
    if (numero.startsWith('44')) return 'GB';
    if (numero.startsWith('49')) return 'DE';
    if (numero.startsWith('33')) return 'FR';
    return 'BR'; // Default to Brazil
  };

  const handleUpdate = () => {
    // Para clientes mensais, a data é obrigatória
    if (selectedCliente?.cobranca_ativa && !newDate) {
      toast({
        title: 'Erro',
        description: 'Selecione uma data de renovação',
        variant: 'destructive',
      });
      return;
    }
    setShowConfirm(true);
  };

  const isClienteVitalicio = selectedCliente && !selectedCliente.cobranca_ativa;

  const confirmUpdate = async () => {
    if (!selectedCliente) return;
    
    const updateData: { 
      data_renovacao?: string; 
      observacao: string; 
      tags: string[]; 
      ciclo_cobranca?: CicloCobranca; 
      moeda?: Moeda; 
      numero?: string; 
      valor?: number; 
      plano?: string | null; 
      email?: string;
      tipo?: string;
      excluir_metricas?: boolean;
      produto?: string;
      cobranca_ativa?: boolean;
    } = {
      observacao: newObservacao,
      tags: newTags,
      numero: newNumero,
      email: newEmail,
      valor: parseCurrency(newValor),
      plano: newPlano,
      moeda: newMoeda,
      tipo: newTipo,
      excluir_metricas: newExcluirMetricas,
      produto: newEditProduto,
    };
    
    // Só atualiza a data e ciclo se for cliente mensal ou estiver convertendo
    if (selectedCliente.cobranca_ativa || showUpgradeConfirm) {
      updateData.data_renovacao = newDate;
      updateData.ciclo_cobranca = newCicloCobranca;
      if (showUpgradeConfirm) {
        updateData.cobranca_ativa = true;
      }
    }
    
    const result = await updateCliente(selectedCliente.id, updateData, selectedCliente);
    
    if (result) {
      logActivity(`${showUpgradeConfirm ? 'Converteu para mensal' : 'Atualizou dados'} do cliente: ${selectedCliente.nome}`, 'cliente');
      setSelectedCliente(null);
      setSearchQuery('');
      setNewDate('');
      setNewObservacao('');
      setNewTags([]);
      setNewNumero('');
      setNewEmail('');
      setNewValor('');
      setNewPlano(null);
      setIsOriginallyReseller(false);
      setSearchPerformed(false);
      setSearchResults([]);
    }
    setShowConfirm(false);
    setShowUpgradeConfirm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border pb-6">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 rounded-xl bg-update/10">
              <RefreshCw className="w-6 h-6 text-update" />
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {t('clients.update.title')}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!selectedCliente ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="space-y-4">
                <Input
                  placeholder={t('clients.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-secondary border-border text-foreground h-12"
                />
                <Button 
                  type="submit" 
                  className="btn-3d w-full h-12 bg-update text-update-foreground hover:bg-update/90 font-medium"
                  disabled={isLoading}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? t('common.loading') : t('common.search')}
                </Button>
              </form>

              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">{t('clients.selectClient')}:</Label>
                  {searchResults.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="group relative flex items-center gap-2 w-full p-3 rounded-lg border border-border bg-card hover:bg-update/10 hover:border-update/50 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectCliente(cliente)}
                        className="flex-1 min-w-0 text-left"
                      >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground truncate">
                              {cliente.nome}{cliente.cpf ? ` - ${cliente.cpf}` : ''}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                cliente.cobranca_ativa 
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20' 
                                  : 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                              }`}>
                                {cliente.cobranca_ativa ? t('clients.monthly') : t('clients.registrationOnly')}
                              </span>
                              {cliente.cobranca_ativa && cliente.data_renovacao && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-update/15 text-update font-bold border border-update/20 shrink-0">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {formatDate(cliente.data_renovacao)}
                                </span>
                              )}
                            </div>
                          </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {cliente.produto}
                        </p>
                      </button>
                          {cliente.observacao && cliente.observacao.trim() && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-update"
                                  onClick={(e) => e.stopPropagation()}
                                  title={t('clients.observations')}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent 
                                className="w-80 sm:w-96 bg-popover border-border shadow-2xl p-0 overflow-hidden" 
                                align="end"
                                side="top"
                                sideOffset={10}
                              >
                                <div className="p-4 border-b border-border bg-muted/30">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                      {t('clients.observations')}
                                    </p>
                                    <FileText className="w-3.5 h-3.5 text-update" />
                                  </div>
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Pesquisar na observação (ex: número)..."
                                      className="h-8 pl-8 text-xs bg-background border-border"
                                      onChange={(e) => {
                                        const term = e.target.value.toLowerCase();
                                        const content = document.getElementById(`obs-${cliente.id}`);
                                        if (!content) return;
                                        
                                        const originalText = cliente.observacao || '';
                                        if (!term) {
                                          content.innerText = originalText;
                                          return;
                                        }

                                        const regex = new RegExp(`(${term})`, 'gi');
                                        const parts = originalText.split(regex);
                                        content.innerHTML = parts.map(part => 
                                          part.toLowerCase() === term 
                                            ? `<mark class="bg-update text-update-foreground rounded-sm px-0.5">${part}</mark>` 
                                            : part
                                        ).join('');
                                        
                                        // Scroll to first match
                                        const firstMatch = content.querySelector('mark');
                                        if (firstMatch) {
                                          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-4 bg-card">
                                  <p 
                                    id={`obs-${cliente.id}`}
                                    className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed"
                                  >
                                    {cliente.observacao}
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                    </div>
                  ))}
                </div>
              ) : searchPerformed ? (
                <div className="text-center py-6 border border-border/50 rounded-lg bg-muted/20">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground font-medium">{t('clients.noClientsFound')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('clients.tryDifferentSearch')}</p>
                </div>
              ) : null}

              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="btn-3d w-full border-border text-muted-foreground hover:bg-secondary h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.back')}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`${(isClienteVitalicio && !showUpgradeConfirm) ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'} border rounded-xl p-5 space-y-4`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-semibold text-lg break-words ${(isClienteVitalicio && !showUpgradeConfirm) ? 'text-amber-500' : 'text-emerald-500'}`}>{selectedCliente.nome}</h3>
                  {isClienteVitalicio && !showUpgradeConfirm && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-500 rounded-full">
                        {t('clients.registrationOnly')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                        onClick={() => {
                          setNewDate(new Date().toISOString().split('T')[0]);
                          setShowUpgradeConfirm(true);
                          setNewEditProduto(''); // Clear previous product to force re-selection
                        }}
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Ativar Mensalidade (Recorrência)
                      </Button>
                    </div>
                  )}
                  {showUpgradeConfirm && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-500 rounded-full flex items-center gap-1 animate-pulse">
                      <TrendingUp className="w-3 h-3" />
                      Upgrade para Mensalidade
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <p className="text-muted-foreground min-w-0 break-words">
                    {t('clients.cpfCnpj')}: <span className="text-foreground">{selectedCliente.cpf || '-'}</span>
                  </p>
                  {!isClienteVitalicio && (
                    <p className="text-muted-foreground sm:text-right">
                      {t('clients.currentDate')}: <span className="text-update font-medium">{formatDate(selectedCliente.data_renovacao)}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t('clients.product')}</Label>
                  <ProductSelector
                    value={newEditProduto}
                    onChange={setNewEditProduto}
                    category={(isClienteVitalicio && !showUpgradeConfirm) ? 'registro' : 'mensal'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="plano" className="text-foreground font-medium">{t('clients.resellerPlan')}</Label>
                </div>
                <Select
                  value={newPlano || 'Individual'}
                  onValueChange={(value) => setNewPlano(value)}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground h-12">
                    <SelectValue placeholder={t('clients.selectPlan')} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Individual">Individual</SelectItem>
                    {availablePlanos.map(plano => (
                      <SelectItem key={plano.id} value={plano.nome}>
                        {plano.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('clients.resellerPlanDesc')}</p>
              </div>

              {(!isClienteVitalicio || showUpgradeConfirm) && (
                <>
                  <div className="space-y-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      <Label htmlFor="newDate" className="text-foreground font-medium">Data do Próximo Vencimento</Label>
                    </div>
                    <Input
                      id="newDate"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="bg-secondary border-border text-foreground h-12"
                    />
                    {showUpgradeConfirm && (
                      <p className="text-[10px] text-emerald-500 mt-1 font-medium">Defina quando será a primeira cobrança mensal deste cliente.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-muted-foreground" />
                      <Label htmlFor="ciclo_cobranca" className="text-foreground font-medium">{t('clients.billingCycle')}</Label>
                    </div>
                    <Select
                      value={newCicloCobranca}
                      onValueChange={(value) => setNewCicloCobranca(value as CicloCobranca)}
                    >
                      <SelectTrigger className="bg-secondary border-border text-foreground h-12">
                        <SelectValue placeholder={t('clients.selectCycle')} />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="mensal">{t('clients.monthly')} (1 {t('common.month')})</SelectItem>
                        <SelectItem value="bimestral">{t('clients.bimonthly')} (2 {t('common.months')})</SelectItem>
                        <SelectItem value="trimestral">{t('clients.quarterly')} (3 {t('common.months')})</SelectItem>
                        <SelectItem value="semestral">{t('clients.semiannual')} (6 {t('common.months')})</SelectItem>
                        <SelectItem value="anual">{t('clients.annual')} (12 {t('common.months')})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <Label htmlFor="moeda" className="text-foreground font-medium">{t('clients.currency')}</Label>
                    </div>
                    <Select
                      value={newMoeda}
                      onValueChange={(value) => {
                        setNewMoeda(value as Moeda);
                        const numericValue = parseCurrency(newValor);
                        setNewValor(formatCurrencyInput(numericValue.toString(), value as Moeda));
                      }}
                    >
                      <SelectTrigger className="bg-secondary border-border text-foreground h-12">
                        <SelectValue placeholder={t('clients.selectCurrency')} />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="BRL">R$ Real (BRL)</SelectItem>
                        <SelectItem value="USD">$ Dollar (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="newValor" className="text-foreground font-medium">{t('clients.value')}</Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="newValor"
                    placeholder={newMoeda === 'USD' ? '$ 0.00' : 'R$ 0,00'}
                    value={newValor}
                    onChange={(e) => setNewValor(formatCurrencyInput(e.target.value, newMoeda))}
                    className="bg-secondary border-border text-foreground h-12 flex-1"
                  />
                  <Select
                    value={newMoeda}
                    onValueChange={(value) => {
                      setNewMoeda(value as Moeda);
                      const numericValue = parseCurrency(newValor);
                      setNewValor(formatCurrencyInput(numericValue.toString(), value as Moeda));
                    }}
                  >
                    <SelectTrigger className="bg-secondary border-border text-foreground h-12 w-32">
                      <SelectValue placeholder={t('clients.selectCurrency')} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="BRL">R$ BRL</SelectItem>
                      <SelectItem value="USD">$ USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isClienteVitalicio && (
                  <p className="text-xs text-muted-foreground">Valor pago na venda única (vitalício)</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="newEmail" className="text-foreground font-medium">E-mail</Label>
                </div>
                <Input
                  id="newEmail"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-secondary border-border text-foreground h-12"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="newNumero" className="text-foreground font-medium">{t('clients.phone')} (WhatsApp)</Label>
                </div>
                <PhoneInputWithCountry
                  value={newNumero}
                  countryCode={newCountryCode}
                  onChange={(phoneWithDDI, code) => {
                    setNewNumero(phoneWithDDI);
                    setNewCountryCode(code);
                  }}
                />
                {isInternationalPhoneNumber(newNumero) && (
                  <div className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <Globe className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-medium text-blue-500 uppercase tracking-tight">
                      Número Internacional Detectado
                    </span>
                  </div>
                )}
              </div>

              {/* Classificação do Cadastro */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-update" />
                  <Label className="text-foreground font-medium">Classificação e Métricas</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo" className="text-xs text-muted-foreground uppercase tracking-wider">Tipo de Cadastro</Label>
                    <Select
                      value={newTipo}
                      onValueChange={(value) => {
                        setNewTipo(value);
                        setNewExcluirMetricas(value !== 'cliente');
                      }}
                    >
                      <SelectTrigger id="tipo" className="bg-secondary border-border text-foreground h-11">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="cliente">💎 Cliente</SelectItem>
                        <SelectItem value="administrativo">⚙️ Administrativo</SelectItem>
                        <SelectItem value="parceiro">🤝 Parceiro / Agência</SelectItem>
                        <SelectItem value="outros">📁 Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border">
                    <div className="space-y-0.5">
                      <Label htmlFor="excluir_metricas" className="text-sm font-medium">Ignorar em Métricas/IA</Label>
                      <p className="text-[10px] text-muted-foreground leading-tight">Não será contabilizado em faturamento e análises de IA.</p>
                    </div>
                    <Switch
                      id="excluir_metricas"
                      checked={newExcluirMetricas}
                      disabled={true}
                      onCheckedChange={(checked) => setNewExcluirMetricas(checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="observacao" className="text-foreground font-medium">{t('clients.observations')}</Label>
                </div>
                <Textarea
                  id="observacao"
                  placeholder={t('clients.observationsPlaceholder')}
                  value={newObservacao}
                  onChange={(e) => setNewObservacao(e.target.value)}
                  className="bg-secondary border-border text-foreground min-h-[100px] resize-none focus:ring-2 focus:ring-update/20"
                />
                <p className="text-xs text-muted-foreground">{t('clients.observationsDesc')}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground font-medium">{t('clients.tags')}</Label>
                <TagInput
                  tags={newTags}
                  onTagsChange={setNewTags}
                  suggestions={availableTags}
                  onlyFromSuggestions={true}
                />
              </div>

              {/* Licenses Manager - show when any plan is selected */}
              {newPlano && newPlano !== 'Individual' && (
                <ClientLicensesManager 
                  clienteId={selectedCliente.id} 
                  clientePlano={newPlano}
                />
              )}

              {/* Files Manager - only for Registro clients */}
              {isClienteVitalicio && (
                <div className="border border-amber-500/20 rounded-xl p-4 bg-amber-500/5">
                  <ClientFilesManager clienteId={selectedCliente.id} />
                </div>
              )}

              <Button
                onClick={() => {
                  if (showUpgradeConfirm) {
                    if (!newDate) {
                      toast({ title: 'Erro', description: 'Selecione a data da primeira mensalidade', variant: 'destructive' });
                      return;
                    }
                  }
                  handleUpdate();
                }}
                className={`btn-3d w-full h-12 font-medium ${showUpgradeConfirm ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-update text-update-foreground hover:bg-update/90'}`}
                disabled={isLoading}
              >
                <Check className="w-4 h-4 mr-2" />
                {showUpgradeConfirm ? 'Confirmar Ativação de Mensalidade' : t('common.update')}
              </Button>

              <Button 
                onClick={() => {
                  setSelectedCliente(null);
                  setSearchResults([]);
                }}
                variant="outline"
                className="btn-3d w-full border-border text-muted-foreground hover:bg-secondary h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.back')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={(open) => {
        setShowConfirm(open);
        if (!open) setShowUpgradeConfirm(false);
      }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {showUpgradeConfirm ? '⚠️ CONFIRMAR UPGRADE PARA MENSALIDADE' : t('clients.confirmUpdate')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              {showUpgradeConfirm 
                ? `Você está transformando ${selectedCliente?.nome} em um cliente recorrente. A primeira mensalidade será cobrada em ${newDate ? formatDate(newDate) : ''}.`
                : isClienteVitalicio 
                  ? t('clients.confirmUpdateRegistration', { name: selectedCliente?.nome })
                  : t('clients.confirmUpdateRenewal', { name: selectedCliente?.nome, date: newDate ? formatDate(newDate) : '' })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmUpdate}
              className={showUpgradeConfirm ? "bg-emerald-500 text-white hover:bg-emerald-600" : isClienteVitalicio ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-update text-update-foreground hover:bg-update/90"}
            >
              {isLoading ? t('common.updating') : showUpgradeConfirm ? 'Sim, Ativar Recorrência' : t('common.yesUpdate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
