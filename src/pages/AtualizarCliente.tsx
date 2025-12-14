import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Search, Check, RefreshCw, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { TagInput } from '@/components/TagInput';
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
    setSearchResults([]);
  };

  const handleUpdate = () => {
    if (!newDate) {
      toast({
        title: 'Erro',
        description: 'Selecione uma data de renovação',
        variant: 'destructive',
      });
      return;
    }
    setShowConfirm(true);
  };

  const confirmUpdate = async () => {
    if (!selectedCliente) return;
    
    const result = await updateCliente(selectedCliente.id, {
      data_renovacao: newDate,
      observacao: newObservacao,
      tags: newTags,
    }, selectedCliente);
    
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
                      {cliente.nome} - {cliente.cpf}
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
              <div className="bg-update/5 border border-update/20 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-update text-lg">{selectedCliente.nome}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{selectedCliente.cpf}</span></p>
                  <p className="text-muted-foreground">Produto: <span className="text-foreground">{selectedCliente.produto}</span></p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Data atual: <span className="text-update font-medium">{formatDate(selectedCliente.data_renovacao)}</span>
                </p>
              </div>

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
              Deseja atualizar a data de renovação do cliente {selectedCliente?.nome} para {newDate ? formatDate(newDate) : ''}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmUpdate}
              className="bg-update text-update-foreground hover:bg-update/90"
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
