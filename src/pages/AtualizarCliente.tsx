import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente, CicloCobranca, Moeda } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Search, Check, RefreshCw, FileText, Repeat, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TagInput } from '@/components/TagInput';
import { ClientFilesManager } from '@/components/ClientFilesManager';
import { supabase } from '@/integrations/supabase/client';
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

export default function AtualizarCliente() {
  const navigate = useNavigate();
  const { searchCliente, updateCliente, isLoading } = useClientes();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newObservacao, setNewObservacao] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newCicloCobranca, setNewCicloCobranca] = useState<CicloCobranca>('mensal');
  const [newMoeda, setNewMoeda] = useState<Moeda>('BRL');
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    loadAvailableTags();
  }, []);

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
  };

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setNewDate(cliente.data_renovacao);
    setNewObservacao(cliente.observacao || '');
    setNewTags(cliente.tags || []);
    setNewCicloCobranca(cliente.ciclo_cobranca || 'mensal');
    setNewMoeda(cliente.moeda || 'BRL');
    setSearchResults([]);
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
    
    const updateData: { data_renovacao?: string; observacao: string; tags: string[]; ciclo_cobranca?: CicloCobranca; moeda?: Moeda } = {
      observacao: newObservacao,
      tags: newTags,
    };
    
    // Só atualiza a data, ciclo e moeda se for cliente mensal
    if (selectedCliente.cobranca_ativa) {
      updateData.data_renovacao = newDate;
      updateData.ciclo_cobranca = newCicloCobranca;
      updateData.moeda = newMoeda;
    }
    
    const result = await updateCliente(selectedCliente.id, updateData, selectedCliente);
    
    if (result) {
      setSelectedCliente(null);
      setSearchQuery('');
      setNewDate('');
      setNewObservacao('');
      setNewTags([]);
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
              Atualizar Cliente
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!selectedCliente ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="space-y-4">
                <Input
                  placeholder="Buscar por CPF, número, email ou nome"
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
                  {isLoading ? 'Buscando...' : 'Buscar'}
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">Selecione o cliente:</Label>
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
              )}

              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="btn-3d w-full border-border text-muted-foreground hover:bg-secondary h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Menu
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`${isClienteVitalicio ? 'bg-amber-500/10 border-amber-500/30' : 'bg-update/5 border-update/20'} border rounded-xl p-5 space-y-3`}>
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold text-lg ${isClienteVitalicio ? 'text-amber-500' : 'text-update'}`}>{selectedCliente.nome}</h3>
                  {isClienteVitalicio && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-500 rounded-full">
                      Registro
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{selectedCliente.cpf}</span></p>
                  <p className="text-muted-foreground">Produto: <span className="text-foreground">{selectedCliente.produto}</span></p>
                </div>
                {!isClienteVitalicio && (
                  <p className="text-sm text-muted-foreground">
                    Data atual: <span className="text-update font-medium">{formatDate(selectedCliente.data_renovacao)}</span>
                  </p>
                )}
              </div>

              {!isClienteVitalicio && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="newDate" className="text-foreground font-medium">Nova Data de Renovação</Label>
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
                      <Label htmlFor="ciclo_cobranca" className="text-foreground font-medium">Ciclo de Cobrança</Label>
                    </div>
                    <Select
                      value={newCicloCobranca}
                      onValueChange={(value) => setNewCicloCobranca(value as CicloCobranca)}
                    >
                      <SelectTrigger className="bg-secondary border-border text-foreground h-12">
                        <SelectValue placeholder="Selecione o ciclo" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="mensal">Mensal (1 mês)</SelectItem>
                        <SelectItem value="bimestral">Bimestral (2 meses)</SelectItem>
                        <SelectItem value="trimestral">Trimestral (3 meses)</SelectItem>
                        <SelectItem value="semestral">Semestral (6 meses)</SelectItem>
                        <SelectItem value="anual">Anual (12 meses)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <Label htmlFor="moeda" className="text-foreground font-medium">Moeda</Label>
                    </div>
                    <Select
                      value={newMoeda}
                      onValueChange={(value) => setNewMoeda(value as Moeda)}
                    >
                      <SelectTrigger className="bg-secondary border-border text-foreground h-12">
                        <SelectValue placeholder="Selecione a moeda" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="BRL">R$ Real (BRL)</SelectItem>
                        <SelectItem value="USD">$ Dólar (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="observacao" className="text-foreground font-medium">Observações</Label>
                </div>
                <Textarea
                  id="observacao"
                  placeholder="Adicione ou edite notas sobre o cliente..."
                  value={newObservacao}
                  onChange={(e) => setNewObservacao(e.target.value)}
                  className="bg-secondary border-border text-foreground min-h-[100px] resize-none focus:ring-2 focus:ring-update/20"
                />
                <p className="text-xs text-muted-foreground">Campo opcional para anotações internas</p>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground font-medium">Tags</Label>
                <TagInput
                  tags={newTags}
                  onTagsChange={setNewTags}
                  suggestions={availableTags}
                  onlyFromSuggestions={true}
                />
              </div>

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
                Atualizar
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
                Voltar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar Atualização</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isClienteVitalicio 
                ? `Deseja atualizar as informações do cliente ${selectedCliente?.nome}?`
                : `Deseja atualizar a data de renovação do cliente ${selectedCliente?.nome} para ${newDate ? formatDate(newDate) : ''}?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmUpdate}
              className={isClienteVitalicio ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-update text-update-foreground hover:bg-update/90"}
            >
              {isLoading ? 'Atualizando...' : 'Sim, atualizar!'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
