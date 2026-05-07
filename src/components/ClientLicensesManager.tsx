import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Key, 
  Trash2, 
  Package, 
  CheckCircle2, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface License {
  id: string;
  ferramenta: string;
  codigo_licenca: string;
  data_entrega: string;
  origem: string;
  observacao: string | null;
}

interface PlanoFerramenta {
  id: string;
  ferramenta: string;
  quantidade_licencas: number;
}

interface ClientLicensesManagerProps {
  clienteId: string;
  clientePlano: string | null;
}

export const ClientLicensesManager = ({ clienteId, clientePlano }: ClientLicensesManagerProps) => {
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [planoFerramentas, setPlanoFerramentas] = useState<PlanoFerramenta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<License | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [newLicense, setNewLicense] = useState({
    ferramenta: '',
    codigo_licenca: '',
    observacao: ''
  });

  useEffect(() => {
    fetchData();
  }, [clienteId, clientePlano]);

  const fetchData = async () => {
    if (clienteId === "preview") {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch licenses
      const { data: licensesData, error: licensesError } = await supabase
        .from('licencas_entregues')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_entrega', { ascending: false });

      if (licensesError) throw licensesError;
      setLicenses(licensesData || []);

      // Fetch plan tools if client has a plan
      if (clientePlano) {
        const { data: planoData, error: planoError } = await supabase
          .from('planos_revendedor')
          .select('id')
          .eq('nome', clientePlano)
          .maybeSingle();

        if (planoData) {
          const { data: ferramentasData, error: ferramentasError } = await supabase
            .from('plano_ferramentas')
            .select('*')
            .eq('plano_id', planoData.id);

          if (!ferramentasError) {
            setPlanoFerramentas(ferramentasData || []);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar licenças',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLicense = async () => {
    if (!newLicense.ferramenta || !newLicense.codigo_licenca) {
      toast({
        title: 'Erro',
        description: 'Ferramenta e código da licença são obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    // Check if license code already exists for this client
    const duplicateLicense = licenses.find(
      l => l.codigo_licenca.toLowerCase() === newLicense.codigo_licenca.toLowerCase()
    );
    if (duplicateLicense) {
      toast({
        title: 'Código duplicado',
        description: `Este código de licença já foi registrado para a ferramenta ${duplicateLicense.ferramenta}`,
        variant: 'destructive'
      });
      return;
    }

    // Check if limit is reached for this tool
    const planTool = planoFerramentas.find(pf => pf.ferramenta === newLicense.ferramenta);
    if (planTool) {
      const usedCount = licenses.filter(l => l.ferramenta === newLicense.ferramenta).length;
      if (usedCount >= planTool.quantidade_licencas) {
        toast({
          title: 'Limite atingido',
          description: `O plano permite apenas ${planTool.quantidade_licencas} licença(s) de ${newLicense.ferramenta}`,
          variant: 'destructive'
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('licencas_entregues')
        .insert({
          cliente_id: clienteId,
          ferramenta: newLicense.ferramenta,
          codigo_licenca: newLicense.codigo_licenca,
          observacao: newLicense.observacao || null,
          origem: 'manual',
          created_by: userData.user?.id
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Licença registrada com sucesso'
      });

      setNewLicense({ ferramenta: '', codigo_licenca: '', observacao: '' });
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error adding license:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao registrar licença',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = (license: License) => {
    setLicenseToDelete(license);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLicense = async () => {
    if (!licenseToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('licencas_entregues')
        .delete()
        .eq('id', licenseToDelete.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Licença excluída com sucesso'
      });

      setIsDeleteDialogOpen(false);
      setLicenseToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting license:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao excluir licença',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate license usage per tool
  const getLicenseUsage = (ferramenta: string) => {
    const used = licenses.filter(l => l.ferramenta === ferramenta).length;
    const planTool = planoFerramentas.find(pf => pf.ferramenta === ferramenta);
    const total = planTool?.quantidade_licencas || 0;
    return { used, total };
  };

  // Get all unique tools from plan and licenses
  const allTools = Array.from(new Set([
    ...planoFerramentas.map(pf => pf.ferramenta),
    ...licenses.map(l => l.ferramenta)
  ]));

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando licenças...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5 text-primary" />
          Licenças Entregues
          {clientePlano && (
            <Badge variant="outline" className="ml-2">
              {clientePlano}
            </Badge>
          )}
        </CardTitle>
        {clienteId !== "preview" && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Licença
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Nova Licença</DialogTitle>
              </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Ferramenta *</Label>
                <Select 
                  value={newLicense.ferramenta} 
                  onValueChange={(value) => setNewLicense(prev => ({ ...prev, ferramenta: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a ferramenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {planoFerramentas.length > 0 ? (
                      planoFerramentas.map(pf => (
                        <SelectItem key={pf.id} value={pf.ferramenta}>
                          {pf.ferramenta}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="WA Marketing">WA Marketing</SelectItem>
                        <SelectItem value="ZapChat">ZapChat</SelectItem>
                        <SelectItem value="MultSender">MultSender</SelectItem>
                        <SelectItem value="PushZap">PushZap</SelectItem>
                        <SelectItem value="OLX Extractor">OLX Extractor</SelectItem>
                        <SelectItem value="Turbo Filter">Turbo Filter</SelectItem>
                        <SelectItem value="Prospector">Prospector</SelectItem>
                        <SelectItem value="SMS RCS">SMS RCS</SelectItem>
                        <SelectItem value="CRMZap">CRMZap</SelectItem>
                        <SelectItem value="ZapDefender">ZapDefender</SelectItem>
                        <SelectItem value="WA Group">WA Group</SelectItem>
                        <SelectItem value="ChatPulse">ChatPulse</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código da Licença *</Label>
                <Input
                  value={newLicense.codigo_licenca}
                  onChange={(e) => setNewLicense(prev => ({ ...prev, codigo_licenca: e.target.value }))}
                  placeholder="Ex: ABC123-XYZ789"
                />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={newLicense.observacao}
                  onChange={(e) => setNewLicense(prev => ({ ...prev, observacao: e.target.value }))}
                  placeholder="Observações sobre a entrega..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddLicense} disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Registrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* License summary by tool */}
        {clientePlano && planoFerramentas.length > 0 && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {planoFerramentas.map(pf => {
              const { used, total } = getLicenseUsage(pf.ferramenta);
              const percentage = total > 0 ? (used / total) * 100 : 0;
              const isComplete = used >= total;
              
              return (
                <div 
                  key={pf.id} 
                  className={`p-3 rounded-lg border ${
                    isComplete ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted/30 border-border/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">{pf.ferramenta}</span>
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    {used}/{total}
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        isComplete ? 'bg-emerald-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* License list */}
        {licenses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma licença registrada</p>
            <p className="text-sm">Clique em "Nova Licença" para adicionar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {licenses.map(license => (
              <div 
                key={license.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shrink-0">
                      {license.ferramenta}
                    </Badge>
                    <code className="text-sm font-mono text-primary truncate">
                      {license.codigo_licenca}
                    </code>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      {format(new Date(license.data_entrega), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {license.origem === 'manual' ? 'Manual' : license.origem === 'api' ? 'API/n8n' : license.origem}
                    </Badge>
                    {license.observacao && (
                      <span className="truncate max-w-[200px]" title={license.observacao}>
                        {license.observacao}
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => openDeleteDialog(license)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta licença?
            </DialogDescription>
          </DialogHeader>
          {licenseToDelete && (
            <div className="py-4 px-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{licenseToDelete.ferramenta}</Badge>
                <code className="text-sm font-mono text-destructive">{licenseToDelete.codigo_licenca}</code>
              </div>
              {licenseToDelete.observacao && (
                <p className="text-sm text-muted-foreground">{licenseToDelete.observacao}</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteLicense} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir Licença'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
