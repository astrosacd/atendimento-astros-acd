import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Search, Trash2, AlertTriangle, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
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

export default function ExcluirCliente() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { searchCliente, deleteCliente, isLoading } = useClientes();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [motivo, setMotivo] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [observacaoPreview, setObservacaoPreview] = useState<Cliente | null>(null);

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
        title: t('clients.delete.reasonTooShort'),
        description: t('clients.delete.reasonTooShortDesc'),
        variant: 'destructive',
      });
      return;
    }
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedCliente) return;
    
    const success = await deleteCliente(selectedCliente.id, selectedCliente);
    
    if (success) {
      setSelectedCliente(null);
      setSearchQuery('');
      setMotivo('');
    }
    setShowConfirm(false);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-xl bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border pb-6">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              {t('clients.delete.title')}
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
                  className="btn-3d w-full h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
                  disabled={isLoading}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? t('common.loading') : t('common.search')}
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">{t('clients.selectClientToDelete')}:</Label>
                  {searchResults.map((cliente) => {
                    const hasObs = !!(cliente.observacao && cliente.observacao.trim());
                    return (
                      <div key={cliente.id} className="flex items-stretch gap-2">
                        <Button
                          onClick={() => handleSelectCliente(cliente)}
                          variant="outline"
                          className="flex-1 justify-start border-border text-foreground hover:bg-destructive/10 hover:border-destructive/50 min-h-12 h-auto py-3 whitespace-normal break-words text-left"
                        >
                          <span className="block w-full">{cliente.nome} - {cliente.cpf} - {cliente.produto}</span>
                        </Button>
                        {hasObs && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setObservacaoPreview(cliente);
                            }}
                            className="shrink-0 h-auto border-border text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-400"
                            title="Ver observação"
                            aria-label="Ver observação"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="btn-3d w-full border-border text-muted-foreground hover:bg-secondary h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('clients.backToMenu')}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h3 className="font-semibold text-destructive text-lg">{selectedCliente.nome}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{selectedCliente.cpf}</span></p>
                  <p className="text-muted-foreground">Produto: <span className="text-foreground">{selectedCliente.produto}</span></p>
                  <p className="text-muted-foreground col-span-2">Email: <span className="text-foreground">{selectedCliente.email}</span></p>
                </div>
                {selectedCliente.observacao && selectedCliente.observacao.trim() && (
                  <div className="mt-3 pt-3 border-t border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Observação do cadastro</p>
                    <div className="bg-background/60 border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                      {selectedCliente.observacao}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo" className="text-foreground font-medium">{t('clients.delete.reason')}</Label>
                <Textarea
                  id="motivo"
                  placeholder={t('clients.delete.reasonPlaceholder')}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="bg-secondary border-border text-foreground min-h-[100px] resize-none"
                />
              </div>

              <Button 
                onClick={handleDelete}
                className="btn-3d w-full h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('clients.delete.title')}
              </Button>

              <Button 
                onClick={() => {
                  setSelectedCliente(null);
                  setSearchResults([]);
                  setMotivo('');
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
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('common.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t('clients.delete.confirmMessage', { name: selectedCliente?.nome })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary text-foreground border-border">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? t('clients.delete.deleting') : t('clients.delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
