import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
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

export default function ExcluirCliente() {
  const navigate = useNavigate();
  const { searchCliente, deleteCliente, isLoading } = useClientes();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [motivo, setMotivo] = useState('');
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
    setSearchResults([]);
  };

  const handleDelete = () => {
    if (motivo.length < 10) {
      toast({
        title: 'Motivo muito curto',
        description: 'Por favor, descreva melhor o motivo da exclusão (mínimo 10 caracteres).',
        variant: 'destructive',
      });
      return;
    }
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedCliente) return;
    
    const success = await deleteCliente(selectedCliente.id);
    
    if (success) {
      setSelectedCliente(null);
      setSearchQuery('');
      setMotivo('');
    }
    setShowConfirm(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl bg-card border-border">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-destructive text-center">
            Excluir Cliente
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
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isLoading}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? 'Buscando...' : 'Buscar'}
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Selecione o cliente para excluir:</Label>
                  {searchResults.map((cliente) => (
                    <Button
                      key={cliente.id}
                      onClick={() => handleSelectCliente(cliente)}
                      variant="outline"
                      className="w-full justify-start border-destructive/50 text-foreground hover:bg-destructive/10"
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
              <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 space-y-2">
                <h3 className="font-bold text-destructive">{selectedCliente.nome}</h3>
                <p className="text-sm text-muted-foreground">CPF/CNPJ: {selectedCliente.cpf}</p>
                <p className="text-sm text-muted-foreground">Produto: {selectedCliente.produto}</p>
                <p className="text-sm text-muted-foreground">Email: {selectedCliente.email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo" className="text-foreground">Motivo da Exclusão</Label>
                <Textarea
                  id="motivo"
                  placeholder="Descreva o motivo da exclusão (mínimo 10 caracteres)"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="bg-input border-border text-foreground min-h-[100px]"
                />
              </div>

              <Button 
                onClick={handleDelete}
                variant="destructive"
                className="w-full"
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Cliente
              </Button>

              <Button 
                onClick={() => {
                  setSelectedCliente(null);
                  setSearchResults([]);
                  setMotivo('');
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
            <AlertDialogTitle className="text-destructive">⚠️ Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Deseja excluir o cliente <strong>{selectedCliente?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {isLoading ? 'Excluindo...' : 'Sim, excluir!'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
