import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Link2, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { NumeroStatus, NumeroModelo } from '@/hooks/useNumerosAquecimento';

interface OrphanNumber {
  id: string;
  numero: string;
  tipo_whatsapp: string | null;
  modelo_id: string | null;
  status_id: string | null;
  observacoes: string | null;
  ultima_atividade: string | null;
  created_at: string;
}

interface Aparelho {
  id: string;
  apelido: string;
  modelo_id: string;
  capacidade_total: number;
}

interface Props {
  statusList: NumeroStatus[];
  modelosList: NumeroModelo[];
}

export function OrphanNumbersTab({ statusList, modelosList }: Props) {
  const qc = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<OrphanNumber | null>(null);
  const [targetAparelhoId, setTargetAparelhoId] = useState<string>('');

  const { data: orphans = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['orphan-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento')
        .select('id, numero, tipo_whatsapp, modelo_id, status_id, observacoes, ultima_atividade, created_at')
        .is('aparelho_id', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OrphanNumber[];
    },
  });

  const { data: aparelhos = [] } = useQuery({
    queryKey: ['aparelhos-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_aparelhos')
        .select('id, apelido, modelo_id, capacidade_total')
        .order('apelido');
      if (error) throw error;
      return (data || []) as Aparelho[];
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ numeroId, aparelhoId }: { numeroId: string; aparelhoId: string }) => {
      const { error } = await supabase
        .from('numeros_aquecimento')
        .update({ aparelho_id: aparelhoId })
        .eq('id', numeroId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Número vinculado ao aparelho');
      qc.invalidateQueries({ queryKey: ['orphan-numbers'] });
      qc.invalidateQueries({ queryKey: ['numeros-aquecimento'] });
      qc.invalidateQueries({ queryKey: ['aparelhos'] });
      setLinkDialogOpen(false);
      setSelected(null);
      setTargetAparelhoId('');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (numeroId: string) => {
      const { error } = await supabase.from('numeros_aquecimento').delete().eq('id', numeroId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Número órfão excluído');
      qc.invalidateQueries({ queryKey: ['orphan-numbers'] });
      qc.invalidateQueries({ queryKey: ['numeros-aquecimento'] });
      setDeleteDialogOpen(false);
      setSelected(null);
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const getModeloNome = (id: string | null) =>
    modelosList.find((m) => m.id === id)?.nome || '—';
  const getStatusNome = (id: string | null) =>
    statusList.find((s) => s.id === id)?.nome || '—';

  const aparelhosCompativeis = useMemo(() => {
    if (!selected?.modelo_id) return aparelhos;
    return aparelhos.filter((a) => a.modelo_id === selected.modelo_id);
  }, [aparelhos, selected]);

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Números Órfãos
          </CardTitle>
          <CardDescription>
            Números que possuem modelo cadastrado mas <strong>não estão vinculados a nenhum aparelho físico</strong>.
            Isso geralmente acontece quando um aparelho é deletado sem migrar seus números.
            Você pode vincular cada número a um aparelho existente ou excluí-lo permanentemente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary">
              {orphans.length} número(s) órfão(s)
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando…
            </div>
          ) : orphans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              ✅ Nenhum número órfão encontrado.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphans.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono text-sm">{n.numero}</TableCell>
                      <TableCell>{getModeloNome(n.modelo_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getStatusNome(n.status_id)}</Badge>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{n.tipo_whatsapp || '—'}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={n.observacoes || ''}>
                        {n.observacoes || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelected(n);
                              setTargetAparelhoId('');
                              setLinkDialogOpen(true);
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            Vincular
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setSelected(n);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular número a aparelho</DialogTitle>
            <DialogDescription>
              Escolha o aparelho físico que vai receber o número <strong>{selected?.numero}</strong>.
              Mostrando apenas aparelhos do mesmo modelo (<strong>{getModeloNome(selected?.modelo_id || null)}</strong>).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Aparelho de destino</Label>
            <Select value={targetAparelhoId} onValueChange={setTargetAparelhoId}>
              <SelectTrigger>
                <SelectValue placeholder={aparelhosCompativeis.length === 0 ? 'Nenhum aparelho compatível cadastrado' : 'Selecione um aparelho'} />
              </SelectTrigger>
              <SelectContent>
                {aparelhosCompativeis.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.apelido} (cap. {a.capacidade_total})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {aparelhosCompativeis.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Não há aparelhos cadastrados para esse modelo. Cadastre um aparelho na aba "Aparelhos" primeiro.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                selected && targetAparelhoId &&
                linkMutation.mutate({ numeroId: selected.id, aparelhoId: targetAparelhoId })
              }
              disabled={!targetAparelhoId || linkMutation.isPending}
            >
              {linkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir número órfão</DialogTitle>
            <DialogDescription>
              O número <strong>{selected?.numero}</strong> será excluído permanentemente.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selected && deleteMutation.mutate(selected.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
