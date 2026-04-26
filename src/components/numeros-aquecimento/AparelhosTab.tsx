import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from '@/components/ui/tabs';
import { Smartphone, Plus, Edit, Trash2, CheckCircle2, AlertCircle, CircleSlash } from 'lucide-react';
import {
  useAparelhos, useCreateAparelho, useUpdateAparelho, useDeleteAparelho,
  calcularOcupacao, sugerirTipoFaltante,
  type Aparelho,
} from '@/hooks/useAparelhos';
import type { NumeroAquecimento, NumeroModelo } from '@/hooks/useNumerosAquecimento';
import { toast } from 'sonner';

interface Props {
  numeros: NumeroAquecimento[];
  modelosList: NumeroModelo[];
}

export function AparelhosTab({ numeros, modelosList }: Props) {
  const { data: aparelhos = [], isLoading } = useAparelhos();
  const createMutation = useCreateAparelho();
  const updateMutation = useUpdateAparelho();
  const deleteMutation = useDeleteAparelho();

  const [filterTab, setFilterTab] = useState<'todos' | 'cheios' | 'com_vaga' | 'vazios'>('todos');

  const ocupacoes = useMemo(
    () => aparelhos.map(a => calcularOcupacao(a, numeros as any)),
    [aparelhos, numeros]
  );

  const filtered = useMemo(() => {
    let list = [...ocupacoes];
    if (filterTab === 'cheios') list = list.filter(o => o.status === 'cheio');
    else if (filterTab === 'com_vaga') list = list.filter(o => o.status === 'parcial' && o.livres > 0);
    else if (filterTab === 'vazios') list = list.filter(o => o.status === 'vazio');
    // Ordenar: vagas faltando primeiro, depois cheios, depois vazios
    return list.sort((a, b) => {
      const score = (o: typeof a) => o.status === 'parcial' ? 0 : o.status === 'cheio' ? 1 : 2;
      return score(a) - score(b);
    });
  }, [ocupacoes, filterTab]);

  const stats = useMemo(() => ({
    total: aparelhos.length,
    cheios: ocupacoes.filter(o => o.status === 'cheio').length,
    com_vaga: ocupacoes.filter(o => o.status === 'parcial' && o.livres > 0).length,
    vazios: ocupacoes.filter(o => o.status === 'vazio').length,
    capacidade_total: aparelhos.reduce((acc, a) => acc + a.capacidade_total, 0),
    ocupacao_total: ocupacoes.reduce((acc, o) => acc + o.ocupados, 0),
  }), [aparelhos, ocupacoes]);

  return (
    <div className="space-y-4">
      {/* Header com estatísticas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Aparelhos Físicos
          </h3>
          <p className="text-sm text-muted-foreground">
            Cadastre cada celular/tablet e defina quantos WhatsApp comporta
          </p>
        </div>
        <AparelhoFormDialog
          modelosList={modelosList}
          onSubmit={(data) => createMutation.mutate(data)}
          isSaving={createMutation.isPending}
          trigger={
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Aparelho
            </Button>
          }
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox
          label="Aparelhos"
          value={stats.total}
          icon={<Smartphone className="h-4 w-4 text-primary" />}
        />
        <StatBox
          label="Cheios"
          value={stats.cheios}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        />
        <StatBox
          label="Com vaga"
          value={stats.com_vaga}
          icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
        />
        <StatBox
          label="Ocupação total"
          value={`${stats.ocupacao_total}/${stats.capacidade_total}`}
          icon={<CircleSlash className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Filtros */}
      <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as typeof filterTab)}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({stats.total})</TabsTrigger>
          <TabsTrigger value="com_vaga">Com vaga ({stats.com_vaga})</TabsTrigger>
          <TabsTrigger value="cheios">Cheios ({stats.cheios})</TabsTrigger>
          <TabsTrigger value="vazios">Vazios ({stats.vazios})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {aparelhos.length === 0
                ? 'Nenhum aparelho cadastrado. Crie o primeiro!'
                : 'Nenhum aparelho neste filtro.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(o => (
            <AparelhoCard
              key={o.aparelho.id}
              ocupacao={o}
              modelosList={modelosList}
              onUpdate={(data) => updateMutation.mutate({ id: o.aparelho.id, data })}
              onDelete={() => deleteMutation.mutate(o.aparelho.id)}
              isSaving={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function AparelhoCard({
  ocupacao, modelosList, onUpdate, onDelete, isSaving,
}: {
  ocupacao: ReturnType<typeof calcularOcupacao>;
  modelosList: NumeroModelo[];
  onUpdate: (data: Partial<Aparelho>) => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const { aparelho, ocupados, livres, percentual, normal, business, status, numeros } = ocupacao;
  const sugestao = sugerirTipoFaltante(ocupacao);

  const statusColor =
    status === 'cheio' ? 'border-green-500/40 bg-green-500/5' :
    status === 'vazio' ? 'border-slate-500/30' :
    'border-amber-500/40 bg-amber-500/5';

  return (
    <Card className={statusColor}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary flex-shrink-0" />
              <h4 className="font-semibold truncate">{aparelho.apelido}</h4>
            </div>
            {aparelho.modelo && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {aparelho.modelo.nome}
                {aparelho.modelo.marca && ` · ${aparelho.modelo.marca}`}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <AparelhoFormDialog
              modelosList={modelosList}
              initialData={aparelho}
              onSubmit={(data) => onUpdate(data)}
              isSaving={isSaving}
              trigger={
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <DeleteAparelhoConfirm
              aparelho={aparelho}
              numerosCount={numeros.length}
              onConfirm={onDelete}
            />
          </div>
        </div>

        {/* Ocupação */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Ocupação</span>
            <span className="font-semibold">
              {ocupados}/{aparelho.capacidade_total}
            </span>
          </div>
          <Progress value={percentual} className="h-2" />
        </div>

        {/* Tipo breakdown */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="text-[10px]">
            Normal: {normal}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Business: {business}
          </Badge>
          {livres > 0 && (
            <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
              Falta {livres}
            </Badge>
          )}
        </div>

        {/* Sugestão */}
        {livres > 0 && sugestao && (
          <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
            💡 Sugerido cadastrar: <span className="font-semibold">{sugestao}</span>
          </div>
        )}

        {/* Lista de números */}
        {numeros.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Números</p>
            {numeros.slice(0, 3).map(n => (
              <div key={n.id} className="flex items-center justify-between text-xs">
                <span className="font-mono truncate">{n.numero}</span>
                {n.tipo_whatsapp && (
                  <Badge variant="outline" className="text-[9px] h-4">
                    {n.tipo_whatsapp === 'business' ? 'B' : 'N'}
                  </Badge>
                )}
              </div>
            ))}
            {numeros.length > 3 && (
              <p className="text-[10px] text-muted-foreground">+{numeros.length - 3} outros</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AparelhoFormDialog({
  modelosList, initialData, onSubmit, isSaving, trigger,
}: {
  modelosList: NumeroModelo[];
  initialData?: Aparelho;
  onSubmit: (data: { apelido: string; modelo_id: string | null; capacidade_total: number; observacoes?: string }) => void;
  isSaving: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [apelido, setApelido] = useState(initialData?.apelido || '');
  const [modeloId, setModeloId] = useState(initialData?.modelo_id || '');
  const [capacidade, setCapacidade] = useState(initialData?.capacidade_total || 3);
  const [observacoes, setObservacoes] = useState(initialData?.observacoes || '');

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o && initialData) {
      setApelido(initialData.apelido);
      setModeloId(initialData.modelo_id || '');
      setCapacidade(initialData.capacidade_total);
      setObservacoes(initialData.observacoes || '');
    } else if (o) {
      setApelido('');
      setModeloId('');
      setCapacidade(3);
      setObservacoes('');
    }
  };

  const handleSubmit = () => {
    if (!apelido.trim()) {
      toast.error('Apelido é obrigatório');
      return;
    }
    if (capacidade < 1 || capacidade > 20) {
      toast.error('Capacidade deve ser entre 1 e 20');
      return;
    }
    onSubmit({
      apelido: apelido.trim(),
      modelo_id: modeloId || null,
      capacidade_total: capacidade,
      observacoes: observacoes.trim() || undefined,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Aparelho' : 'Novo Aparelho'}</DialogTitle>
          <DialogDescription>
            Cada aparelho representa um celular físico que comporta um número limitado de WhatsApp
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Apelido *</Label>
            <Input
              placeholder="Ex: A03 #1, M7 Vendas, iPhone Marketing"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Como você identifica este aparelho específico
            </p>
          </div>

          <div>
            <Label>Modelo</Label>
            <SearchableSelect
              options={modelosList.map(m => ({ value: m.id, label: m.nome }))}
              value={modeloId}
              onValueChange={setModeloId}
              placeholder="Selecione o modelo"
              searchPlaceholder="Buscar modelo..."
              emptyMessage="Nenhum modelo encontrado."
            />
          </div>

          <div>
            <Label>Capacidade total de WhatsApp *</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={capacidade}
              onChange={(e) => setCapacidade(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quantos WhatsApp (normal + business) cabem neste aparelho
            </p>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              placeholder="Notas internas sobre o aparelho..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAparelhoConfirm({
  aparelho, numerosCount, onConfirm,
}: {
  aparelho: Aparelho;
  numerosCount: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir aparelho "{aparelho.apelido}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {numerosCount > 0 ? (
              <>
                Este aparelho tem <strong>{numerosCount}</strong> {numerosCount === 1 ? 'número associado' : 'números associados'}.
                Os números <strong>não serão excluídos</strong>, apenas desvinculados deste aparelho.
              </>
            ) : (
              'Este aparelho não tem números associados. A exclusão é segura.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
