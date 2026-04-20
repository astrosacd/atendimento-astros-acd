import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';
import { 
  Plus, 
  Package, 
  Settings, 
  Trash2,
  Edit,
  Key
} from 'lucide-react';

interface Plano {
  id: string;
  nome: string;
  valor: number;
  descricao: string | null;
  is_active: boolean;
}

interface PlanoFerramenta {
  id: string;
  plano_id: string;
  ferramenta: string;
  quantidade_licencas: number;
}

const AdminPlanosRevendedor = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [ferramentas, setFerramentas] = useState<PlanoFerramenta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const [isPlanoDialogOpen, setIsPlanoDialogOpen] = useState(false);
  const [isFerramentaDialogOpen, setIsFerramentaDialogOpen] = useState(false);
  
  
  const [planoForm, setPlanoForm] = useState({
    nome: '',
    valor: 0,
    descricao: '',
    is_active: true
  });

  const [ferramentaForm, setFerramentaForm] = useState({
    ferramenta: '',
    quantidade_licencas: 5
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: planosData, error: planosError } = await supabase
        .from('planos_revendedor')
        .select('*')
        .order('valor', { ascending: true });

      if (planosError) throw planosError;
      setPlanos(planosData || []);

      const { data: ferramentasData, error: ferramentasError } = await supabase
        .from('plano_ferramentas')
        .select('*')
        .order('ferramenta', { ascending: true });

      if (ferramentasError) throw ferramentasError;
      setFerramentas(ferramentasData || []);

      if (planosData && planosData.length > 0 && !selectedPlano) {
        setSelectedPlano(planosData[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePlano = async () => {
    try {
      if (selectedPlano?.id && isPlanoDialogOpen) {
        // Update existing
        const { error } = await supabase
          .from('planos_revendedor')
          .update(planoForm)
          .eq('id', selectedPlano.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Plano atualizado' });
      } else {
        // Create new
        const { error } = await supabase
          .from('planos_revendedor')
          .insert(planoForm);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Plano criado' });
      }

      setIsPlanoDialogOpen(false);
      setPlanoForm({ nome: '', valor: 0, descricao: '', is_active: true });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeletePlano = async (planoId: string) => {
    if (!confirm('Tem certeza? Isso excluirá todas as ferramentas do plano.')) return;

    try {
      const { error } = await supabase
        .from('planos_revendedor')
        .delete()
        .eq('id', planoId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Plano excluído' });
      
      if (selectedPlano?.id === planoId) {
        setSelectedPlano(null);
      }
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleAddFerramenta = async () => {
    if (!selectedPlano) return;

    try {
      const { error } = await supabase
        .from('plano_ferramentas')
        .insert({
          plano_id: selectedPlano.id,
          ferramenta: ferramentaForm.ferramenta,
          quantidade_licencas: ferramentaForm.quantidade_licencas
        });

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Ferramenta adicionada' });
      setIsFerramentaDialogOpen(false);
      setFerramentaForm({ ferramenta: '', quantidade_licencas: 5 });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteFerramenta = async (ferramentaId: string) => {
    if (!confirm('Excluir esta ferramenta do plano?')) return;

    try {
      const { error } = await supabase
        .from('plano_ferramentas')
        .delete()
        .eq('id', ferramentaId);

      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Ferramenta removida' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleUpdateQuantidade = async (ferramentaId: string, quantidade: number) => {
    try {
      const { error } = await supabase
        .from('plano_ferramentas')
        .update({ quantidade_licencas: quantidade })
        .eq('id', ferramentaId);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    __copyToClipboard(text);
  };

  const planoFerramentas = selectedPlano 
    ? ferramentas.filter(f => f.plano_id === selectedPlano.id)
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('reseller.title')}</h1>
            <p className="text-muted-foreground">{t('reseller.subtitle')}</p>
          </div>
        </div>

        <Tabs defaultValue="planos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="planos" className="gap-2">
              <Package className="h-4 w-4" />
              {t('reseller.plans')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="planos" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Plans List */}
              <Card className="lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Planos</CardTitle>
                  <Dialog open={isPlanoDialogOpen} onOpenChange={setIsPlanoDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => setPlanoForm({ nome: '', valor: 0, descricao: '', is_active: true })}
                      >
                        <Plus className="h-4 w-4" />
                        Novo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {planoForm.nome ? 'Editar Plano' : 'Novo Plano'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Nome do Plano *</Label>
                          <Input
                            value={planoForm.nome}
                            onChange={(e) => setPlanoForm(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Ex: Plano Premium"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={planoForm.valor}
                            onChange={(e) => setPlanoForm(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Textarea
                            value={planoForm.descricao}
                            onChange={(e) => setPlanoForm(prev => ({ ...prev, descricao: e.target.value }))}
                            placeholder="Descrição do plano..."
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={planoForm.is_active}
                            onCheckedChange={(checked) => setPlanoForm(prev => ({ ...prev, is_active: checked }))}
                          />
                          <Label>Ativo</Label>
                        </div>
                        <div className="flex gap-2 justify-end pt-4">
                          <Button variant="outline" onClick={() => setIsPlanoDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleSavePlano}>
                            Salvar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoading ? (
                    <p className="text-muted-foreground text-center py-4">Carregando...</p>
                  ) : planos.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhum plano cadastrado</p>
                  ) : (
                    planos.map(plano => (
                      <div
                        key={plano.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPlano?.id === plano.id 
                            ? 'bg-primary/10 border-primary' 
                            : 'bg-muted/30 border-border/50 hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedPlano(plano)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {plano.nome}
                              {!plano.is_active && (
                                <Badge variant="secondary" className="text-xs">Inativo</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              R$ {plano.valor.toFixed(2).replace('.', ',')}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlanoForm({
                                  nome: plano.nome,
                                  valor: plano.valor,
                                  descricao: plano.descricao || '',
                                  is_active: plano.is_active
                                });
                                setSelectedPlano(plano);
                                setIsPlanoDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePlano(plano.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Tools for selected plan */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Ferramentas
                    {selectedPlano && (
                      <Badge variant="outline">{selectedPlano.nome}</Badge>
                    )}
                  </CardTitle>
                  {selectedPlano && (
                    <Dialog open={isFerramentaDialogOpen} onOpenChange={setIsFerramentaDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adicionar Ferramenta</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label>Nome da Ferramenta *</Label>
                            <Input
                              value={ferramentaForm.ferramenta}
                              onChange={(e) => setFerramentaForm(prev => ({ ...prev, ferramenta: e.target.value }))}
                              placeholder="Ex: WA Marketing"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantidade de Licenças</Label>
                            <Input
                              type="number"
                              value={ferramentaForm.quantidade_licencas}
                              onChange={(e) => setFerramentaForm(prev => ({ ...prev, quantidade_licencas: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-4">
                            <Button variant="outline" onClick={() => setIsFerramentaDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleAddFerramenta}>
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedPlano ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Selecione um plano para ver suas ferramentas</p>
                    </div>
                  ) : planoFerramentas.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhuma ferramenta neste plano</p>
                      <p className="text-sm">Clique em "Adicionar" para incluir ferramentas</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {planoFerramentas.map(ferramenta => (
                        <div
                          key={ferramenta.id}
                          className="p-4 rounded-lg bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{ferramenta.ferramenta}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteFerramenta(ferramenta.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={ferramenta.quantidade_licencas}
                              onChange={(e) => handleUpdateQuantidade(ferramenta.id, parseInt(e.target.value) || 0)}
                              className="w-20 h-8 text-center"
                            />
                            <span className="text-xs text-muted-foreground">licenças</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminPlanosRevendedor;
