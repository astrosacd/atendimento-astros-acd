import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, ShoppingBag, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface Purchase {
  id: string;
  valor: number;
  moeda: string;
  produto: string;
  descricao: string | null;
  data_compra: string;
  created_at: string;
}

interface ClientPurchasesManagerProps {
  clienteId: string;
  clienteNome: string;
}

export function ClientPurchasesManager({ clienteId, clienteNome }: ClientPurchasesManagerProps) {
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPurchase, setNewPurchase] = useState({
    valor: '',
    moeda: 'BRL',
    produto: '',
    descricao: '',
    data_compra: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchPurchases = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('client_purchases')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_compra', { ascending: false });

    if (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Erro ao carregar histórico de compras');
    } else {
      setPurchases(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPurchases();
  }, [clienteId]);

  const handleAddPurchase = async () => {
    if (!newPurchase.valor || !newPurchase.produto) {
      toast.error('Preencha o valor e o produto');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('client_purchases').insert({
      cliente_id: clienteId,
      valor: parseFloat(newPurchase.valor),
      moeda: newPurchase.moeda,
      produto: newPurchase.produto,
      descricao: newPurchase.descricao || null,
      data_compra: newPurchase.data_compra,
      created_by: userData.user?.id
    });

    if (error) {
      console.error('Error adding purchase:', error);
      toast.error('Erro ao adicionar compra');
    } else {
      toast.success('Compra adicionada com sucesso!');
      setIsDialogOpen(false);
      setNewPurchase({
        valor: '',
        moeda: 'BRL',
        produto: '',
        descricao: '',
        data_compra: format(new Date(), 'yyyy-MM-dd')
      });
      fetchPurchases();
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    const { error } = await supabase
      .from('client_purchases')
      .delete()
      .eq('id', purchaseId);

    if (error) {
      console.error('Error deleting purchase:', error);
      toast.error('Erro ao excluir compra');
    } else {
      toast.success('Compra excluída com sucesso!');
      fetchPurchases();
    }
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const totalValue = purchases.reduce((acc, p) => {
    // Convert to BRL for total (simplified - in production you'd use exchange rates)
    return acc + (p.moeda === 'USD' ? p.valor * 5 : p.valor);
  }, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="h-5 w-5" />
          Histórico de Compras
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Compra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Compra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newPurchase.valor}
                    onChange={(e) => setNewPurchase(prev => ({ ...prev, valor: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Select
                    value={newPurchase.moeda}
                    onValueChange={(value) => setNewPurchase(prev => ({ ...prev, moeda: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">R$ (BRL)</SelectItem>
                      <SelectItem value="USD">$ (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Input
                  placeholder="Nome do produto"
                  value={newPurchase.produto}
                  onChange={(e) => setNewPurchase(prev => ({ ...prev, produto: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="Detalhes da compra"
                  value={newPurchase.descricao}
                  onChange={(e) => setNewPurchase(prev => ({ ...prev, descricao: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data da Compra</Label>
                <Input
                  type="date"
                  value={newPurchase.data_compra}
                  onChange={(e) => setNewPurchase(prev => ({ ...prev, data_compra: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddPurchase}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma compra registrada</p>
            <p className="text-sm">Clique em "Nova Compra" para adicionar</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-primary/10 rounded-lg flex items-center justify-between">
              <span className="text-sm font-medium">Total em Compras:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(totalValue, 'BRL')}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(purchase.data_compra), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{purchase.produto}</p>
                        {purchase.descricao && (
                          <p className="text-xs text-muted-foreground">{purchase.descricao}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 font-medium text-amber-500">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(purchase.valor, purchase.moeda)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePurchase(purchase.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
