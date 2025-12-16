import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { UserMinus, Search, Trash2, Loader2, AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function InactiveParticipantsManager() {
  const queryClient = useQueryClient();
  const [inactiveDays, setInactiveDays] = useState(30);
  const [selectedGroup, setSelectedGroup] = useState<string>('_all');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ['divulgador-groups'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_groups')
        .select('id, name, whatsapp_group_id')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: participants = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inactive-participants', selectedGroup, inactiveDays],
    queryFn: async () => {
      let query = (supabase as any)
        .from('divulgador_participants')
        .select('*, divulgador_groups(name, whatsapp_group_id)')
        .is('left_at', null)
        .order('last_message_at', { ascending: true, nullsFirst: true });

      if (selectedGroup && selectedGroup !== '_all') {
        query = query.eq('group_id', selectedGroup);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by inactivity
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

      return (data || []).filter((p: any) => {
        if (!p.last_message_at) return true; // Never sent message
        return new Date(p.last_message_at) < cutoffDate;
      });
    },
    enabled: hasSearched,
  });

  const handleSearch = useCallback(() => {
    setHasSearched(true);
    setSelectedParticipants([]);
    refetch();
  }, [refetch]);

  const toggleSelectAll = () => {
    if (selectedParticipants.length === participants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map((p: any) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedParticipants.includes(id)) {
      setSelectedParticipants(selectedParticipants.filter((i) => i !== id));
    } else {
      setSelectedParticipants([...selectedParticipants, id]);
    }
  };

  const removeParticipants = async () => {
    if (selectedParticipants.length === 0) return;

    setIsRemoving(true);
    try {
      // Group participants by group
      const participantsToRemove = participants.filter((p: any) => selectedParticipants.includes(p.id));
      const byGroup: Record<string, { groupId: string; whatsappGroupId: string; numbers: string[] }> = {};

      for (const p of participantsToRemove) {
        const groupId = p.group_id;
        const whatsappGroupId = p.divulgador_groups?.whatsapp_group_id;
        if (!byGroup[groupId]) {
          byGroup[groupId] = { groupId, whatsappGroupId, numbers: [] };
        }
        byGroup[groupId].numbers.push(p.whatsapp_number);
      }

      // Remove from WhatsApp via Edge Function
      for (const group of Object.values(byGroup)) {
        const { error } = await supabase.functions.invoke('divulgador-groups', {
          body: {
            action: 'remove-participants',
            groupId: group.whatsappGroupId,
            numbers: group.numbers,
          },
        });
        if (error) console.error('Erro ao remover do grupo:', error);
      }

      // Mark as left in database
      await (supabase as any)
        .from('divulgador_participants')
        .update({ left_at: new Date().toISOString() })
        .in('id', selectedParticipants);

      toast.success(`${selectedParticipants.length} participantes removidos!`);
      setSelectedParticipants([]);
      setIsConfirmDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['inactive-participants'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-participants'] });
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
    } catch (error: any) {
      toast.error('Erro ao remover: ' + error.message);
    } finally {
      setIsRemoving(false);
    }
  };

  const getInactivityInfo = (participant: any) => {
    if (!participant.last_message_at) {
      return { text: 'Nunca enviou', days: null, color: 'text-destructive' };
    }
    const days = differenceInDays(new Date(), new Date(participant.last_message_at));
    if (days >= 60) return { text: `${days} dias`, days, color: 'text-destructive' };
    if (days >= 30) return { text: `${days} dias`, days, color: 'text-amber-500' };
    return { text: `${days} dias`, days, color: 'text-muted-foreground' };
  };

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserMinus className="h-5 w-5 text-red-500" />
          Remoção de Participantes Inativos
        </CardTitle>
        <CardDescription>
          Identifique membros que não interagem e remova-os em massa dos grupos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os grupos</SelectItem>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Inativo há mais de (dias)</Label>
            <Input
              type="number"
              className="w-[120px]"
              value={inactiveDays}
              onChange={(e) => setInactiveDays(parseInt(e.target.value) || 30)}
              min={1}
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading || isFetching}>
            {(isLoading || isFetching) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Inativos
          </Button>
          {selectedParticipants.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setIsConfirmDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover ({selectedParticipants.length})
            </Button>
          )}
        </div>

        {/* Results */}
        {!hasSearched ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <p className="text-muted-foreground">Configure os filtros e clique em "Buscar Inativos" para ver os resultados</p>
          </div>
        ) : (isLoading || isFetching) ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : participants.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <p className="text-muted-foreground">Nenhum participante inativo encontrado com os critérios selecionados</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{participants.length}</span> participantes inativos há mais de {inactiveDays} dias
              </p>
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {selectedParticipants.length === participants.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedParticipants.length === participants.length && participants.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Última Mensagem</TableHead>
                    <TableHead>Inatividade</TableHead>
                    <TableHead>Mensagens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p: any) => {
                    const inactivity = getInactivityInfo(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedParticipants.includes(p.id)}
                            onCheckedChange={() => toggleSelect(p.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{p.whatsapp_number}</TableCell>
                        <TableCell>{p.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.divulgador_groups?.name || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.last_message_at
                            ? format(new Date(p.last_message_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1 ${inactivity.color}`}>
                            <Clock className="h-3 w-3" />
                            {inactivity.text}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            {p.message_count || 0}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Remoção
            </DialogTitle>
            <DialogDescription>
              Você está prestes a remover <strong>{selectedParticipants.length}</strong> participantes inativos dos grupos.
              Eles serão removidos do WhatsApp e marcados como saídos no sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} disabled={isRemoving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={removeParticipants} disabled={isRemoving}>
              {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Remover Participantes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
