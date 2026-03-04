import { useState, useMemo } from 'react';
import { PipelineStage, PipelineClient } from '@/pages/KanbanClientes';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from '@/components/ui/command';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { 
  RefreshCw, Search, UserPlus, MoreVertical, ArrowRight, Trash2,
  Package, Calendar, DollarSign, Check, ChevronsUpDown
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  stages: PipelineStage[];
  clients: PipelineClient[];
  allClients: any[];
  loading: boolean;
  onMoveClient: (clienteId: string, stageId: string) => Promise<void>;
  onRemoveClient: (clienteId: string) => Promise<void>;
  onRefresh: () => void;
}

export function KanbanBoard({ stages, clients, allClients, loading, onMoveClient, onRemoveClient, onRefresh }: KanbanBoardProps) {
  const [search, setSearch] = useState('');
  const [addingToStage, setAddingToStage] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [movingClient, setMovingClient] = useState<string | null>(null);

  const clientsInPipeline = useMemo(() => new Set(clients.map(c => c.cliente_id)), [clients]);
  
  const availableClients = useMemo(
    () => allClients.filter(c => !clientsInPipeline.has(c.id)),
    [allClients, clientsInPipeline]
  );

  const getStageClients = (stageId: string) => {
    return clients
      .filter(c => c.stage_id === stageId)
      .filter(c => {
        if (!search) return true;
        const q = search.toLowerCase();
        return c.cliente?.nome?.toLowerCase().includes(q) || 
               c.cliente?.produto?.toLowerCase().includes(q) ||
               c.cliente?.email?.toLowerCase().includes(q);
      });
  };

  const handleAddClient = async (stageId: string) => {
    if (!selectedClient) return;
    setMovingClient(selectedClient);
    await onMoveClient(selectedClient, stageId);
    setSelectedClient('');
    setAddingToStage(null);
    setMovingClient(null);
  };

  const getRenewalStatus = (dataRenovacao: string) => {
    const days = differenceInDays(new Date(), new Date(dataRenovacao));
    if (days > 30) return { label: `${days}d atraso`, variant: 'destructive' as const };
    if (days > 0) return { label: `${days}d atraso`, variant: 'outline' as const };
    if (days === 0) return { label: 'Hoje', variant: 'default' as const };
    return { label: `${Math.abs(days)}d restante`, variant: 'secondary' as const };
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="min-w-[300px] space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {clients.length} no pipeline / {allClients.length} total
        </span>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
        {stages.map(stage => {
          const stageClients = getStageClients(stage.id);
          return (
            <div
              key={stage.id}
              className="min-w-[300px] max-w-[300px] flex flex-col bg-secondary/30 rounded-lg border border-border"
            >
              {/* Column header */}
              <div
                className="px-3 py-2.5 border-b border-border flex items-center justify-between rounded-t-lg"
                style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{stage.name}</span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{stageClients.length}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setAddingToStage(addingToStage === stage.id ? null : stage.id)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Add client widget */}
              {addingToStage === stage.id && (
                <div className="p-2 border-b border-border bg-card/50">
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="h-8 text-xs bg-secondary border-border mb-1.5">
                      <SelectValue placeholder="Selecionar cliente..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {availableClients.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.nome} — {c.produto}
                        </SelectItem>
                      ))}
                      {availableClients.length === 0 && (
                        <div className="text-xs text-muted-foreground p-2">Todos os clientes já estão no pipeline</div>
                      )}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleAddClient(stage.id)} disabled={!selectedClient || movingClient === selectedClient}>
                      Adicionar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingToStage(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards */}
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {stageClients.map(pc => {
                    const c = pc.cliente;
                    if (!c) return null;
                    const renewal = getRenewalStatus(c.data_renovacao);
                    
                    return (
                      <Card
                        key={pc.id}
                        className="p-3 bg-card border-border hover:border-primary/30 transition-colors cursor-default group"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground truncate">{c.nome}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Package className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.produto}</span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                              {stages.filter(s => s.id !== stage.id).map(s => (
                                <DropdownMenuItem
                                  key={s.id}
                                  onClick={() => onMoveClient(c.id, s.id)}
                                  className="text-xs gap-2"
                                >
                                  <ArrowRight className="h-3 w-3" />
                                  Mover para {s.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                onClick={() => onRemoveClient(c.id)}
                                className="text-xs gap-2 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remover do pipeline
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <Badge variant={renewal.variant} className="text-[10px] px-1.5 py-0">
                            <Calendar className="h-2.5 w-2.5 mr-0.5" />
                            {renewal.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <DollarSign className="h-2.5 w-2.5" />
                            {c.moeda === 'USD' ? '$' : 'R$'} {Number(c.valor).toFixed(2)}
                          </span>
                        </div>

                        {c.tags && c.tags.length > 0 && (
                          <div className="mt-1.5 flex gap-1 flex-wrap">
                            {c.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}

                  {stageClients.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-xs">Nenhum cliente nesta etapa</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
