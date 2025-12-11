import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Search, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    const results = await searchCliente(searchQuery);
    setSearchResults(results);
  };

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setNewDate(cliente.data_renovacao);
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
    });
    
    if (result) {
      setSelectedCliente(null);
      setSearchQuery('');
      setNewDate('');
    }
    setShowConfirm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl bg-card border-border">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-warning text-center">
            Atualizar Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedCliente ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="space-y-4">
                <Input
                  placeholder="Buscar por CPF, número ou nome"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
                <Button 
                  type="submit" 
                  className="w-full bg-warning text-foreground hover:bg-warning/90"
                  disabled={isLoading}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? 'Buscando...' : 'Buscar'}
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Selecione o cliente:</Label>
                  {searchResults.map((cliente) => (
                    <Button
                      key={cliente.id}
                      onClick={() => handleSelectCliente(cliente)}
                      variant="outline"
                      className="w-full justify-start border-border text-foreground hover:bg-secondary"
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
                className="w-full border-border text-foreground hover:bg-secondary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Menu
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-secondary rounded-lg p-4 space-y-2">
                <h3 className="font-bold text-primary">{selectedCliente.nome}</h3>
                <p className="text-sm text-muted-foreground">CPF/CNPJ: {selectedCliente.cpf}</p>
                <p className="text-sm text-muted-foreground">Produto: {selectedCliente.produto}</p>
                <p className="text-sm text-muted-foreground">
                  Data atual de renovação: {formatDate(selectedCliente.data_renovacao)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newDate" className="text-foreground">Nova Data de Renovação</Label>
                <Input
                  id="newDate"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>

              <Button 
                onClick={handleUpdate}
                className="w-full bg-warning text-foreground hover:bg-warning/90"
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
                className="w-full border-border text-foreground hover:bg-secondary"
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
            <AlertDialogCancel className="bg-secondary text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmUpdate}
              className="bg-warning text-foreground"
            >
              {isLoading ? 'Atualizando...' : 'Sim, atualizar!'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
