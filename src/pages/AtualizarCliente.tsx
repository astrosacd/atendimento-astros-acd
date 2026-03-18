import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente, CicloCobranca, Moeda } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Check, RefreshCw, FileText, Repeat, DollarSign, Phone, Store, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TagInput } from '@/components/TagInput';
import { ClientFilesManager } from '@/components/ClientFilesManager';
import { ClientLicensesManager } from '@/components/ClientLicensesManager';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrencyInput, parseCurrency, formatCurrencyDisplay } from '@/utils/formatters';
import { PhoneInputWithCountry } from '@/components/PhoneInputWithCountry';
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

export default function AtualizarCliente() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availablePlanos, setAvailablePlanos] = useState<{ id: string; nome: string }[]>([]);
  const [newPlano, setNewPlano] = useState<string | null>(null);
  const [isOriginallyReseller, setIsOriginallyReseller] = useState(false);

  const normalizePlano = (plano?: string | null) => {
    if (!plano) return null;
    const cleaned = plano.trim();
    if (!cleaned) return null;
    if (cleaned.toLowerCase() === 'none') return null;
    if (cleaned.toLowerCase() === 'nenhum') return null;
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

  const handleSelectCliente = (cliente: Cliente) => {
    const planoNormalizado = normalizePlano(cliente.plano);
    const clienteIsReseller = planoNormalizado !== null;

    setSelectedCliente(cliente);
    setNewDate(cliente.data_renovacao);
    setNewObservacao(cliente.observacao || '');
    setNewTags(cliente.tags || []);
    setNewCicloCobranca(cliente.ciclo_cobranca || 'mensal');
    setNewMoeda(cliente.moeda || 'BRL');
    setNewNumero(cliente.numero || '');
    setNewEmail(cliente.email || '');
    setNewPlano(planoNormalizado);
    setIsOriginallyReseller(clienteIsReseller);
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
    
    const updateData: { data_renovacao?: string; observacao: string; tags: string[]; ciclo_cobranca?: CicloCobranca; moeda?: Moeda; numero?: string; valor?: number; plano?: string | null } = {
      observacao: newObservacao,
      tags: newTags,
      numero: newNumero,
      valor: parseCurrency(newValor),
      plano: newPlano,
      moeda: newMoeda,
    };
    
    // Só atualiza a data e ciclo se for cliente mensal
    if (selectedCliente.cobranca_ativa) {
      updateData.data_renovacao = newDate;
      updateData.ciclo_cobranca = newCicloCobranca;
    }
    
    const result = await updateCliente(selectedCliente.id, updateData, selectedCliente);
    
    if (result) {
      setSelectedCliente(null);
      setSearchQuery('');
      setNewDate('');
      setNewObservacao('');
      setNewTags([]);
      setNewNumero('');
      setNewValor('');
      setNewPlano(null);
      setIsOriginallyReseller(false);
      setSearchPerformed(false);
      setSearchResults([]);
    }
    setShowConfirm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-xl bg-card border-border shadow-xl">
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
                    <Button
                      key={cliente.id}
                      onClick={() => handleSelectCliente(cliente)}
                      variant="outline"
                      className="w-full justify-start border-border text-foreground hover:bg-update/10 hover:border-update/50 h-12"
                    >
                      {cliente.nome} - {cliente.cpf} - {cliente.produto}
                    </Button>
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
              <div className={`${isClienteVitalicio ? 'bg-amber-500/10 border-amber-500/30' : 'bg-update/5 border-update/20'} border rounded-xl p-5 space-y-3`}>
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold text-lg ${isClienteVitalicio ? 'text-amber-500' : 'text-update'}`}>{selectedCliente.nome}</h3>
                  {isClienteVitalicio && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-500 rounded-full">
                      {t('clients.registrationOnly')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">{t('clients.cpfCnpj')}: <span className="text-foreground">{selectedCliente.cpf}</span></p>
                  <p className="text-muted-foreground">{t('clients.product')}: <span className="text-foreground">{selectedCliente.produto}</span></p>
                </div>
                {!isClienteVitalicio && (
                  <p className="text-sm text-muted-foreground">
                    {t('clients.currentDate')}: <span className="text-update font-medium">{formatDate(selectedCliente.data_renovacao)}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="plano" className="text-foreground font-medium">{t('clients.resellerPlan')}</Label>
                </div>
                <Select
                  value={newPlano || 'none'}
                  onValueChange={(value) => setNewPlano(value === 'none' ? null : value)}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground h-12">
                    <SelectValue placeholder={t('clients.selectPlan')} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none">{t('clients.noPlan')}</SelectItem>
                    {availablePlanos.map(plano => (
                      <SelectItem key={plano.id} value={plano.nome}>
                        {plano.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('clients.resellerPlanDesc')}</p>
              </div>

              {!isClienteVitalicio && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="newDate" className="text-foreground font-medium">{t('clients.newRenewalDate')}</Label>
                    <Input
                      id="newDate"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="bg-secondary border-border text-foreground h-12"
                    />
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
              {newPlano && (
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
                onClick={handleUpdate}
                className="btn-3d w-full h-12 bg-update text-update-foreground hover:bg-update/90 font-medium"
                disabled={isLoading}
              >
                <Check className="w-4 h-4 mr-2" />
                {t('common.update')}
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

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t('clients.confirmUpdate')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isClienteVitalicio 
                ? t('clients.confirmUpdateRegistration', { name: selectedCliente?.nome })
                : t('clients.confirmUpdateRenewal', { name: selectedCliente?.nome, date: newDate ? formatDate(newDate) : '' })
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmUpdate}
              className={isClienteVitalicio ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-update text-update-foreground hover:bg-update/90"}
            >
              {isLoading ? t('common.updating') : t('common.yesUpdate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
