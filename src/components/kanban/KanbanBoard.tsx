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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { 
  RefreshCw, Search, UserPlus, MoreVertical, ArrowRight, Trash2,
  Package, Calendar, DollarSign, Check, ChevronsUpDown, UserRoundPlus, ArrowRightCircle,
  MessageSquarePlus
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { LeadFormDialog } from './LeadFormDialog';
import { ConvertLeadDialog } from './ConvertLeadDialog';

interface KanbanBoardProps {
  stages: PipelineStage[];
  clients: PipelineClient[];
  allClients: any[];
  loading: boolean;
  isReadOnly?: boolean;
  onMoveClient?: (clienteId: string, stageId: string) => Promise<void>;
  onMovePipelineItem?: (pipelineId: string, stageId: string) => Promise<void>;
  onRemoveClient?: (pipelineId: string) => Promise<void>;
  onAddLead?: (stageId: string, lead: { name: string; phone: string; email: string; produto: string }) => Promise<void>;
  onConvertLead?: (data: any) => Promise<void>;
  onRefresh: () => void;
}

export function KanbanBoard({ 
  stages, clients, allClients, loading, isReadOnly = false, onMoveClient, onMovePipelineItem, onRemoveClient, onAddLead, onConvertLead, onRefresh
}: KanbanBoardProps) {
  const [search, setSearch] = useState('');
  const [addingToStage, setAddingToStage] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [movingClient, setMovingClient] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [leadFormStage, setLeadFormStage] = useState<string | null>(null);
  const [convertingLead, setConvertingLead] = useState<PipelineClient | null>(null);

  const clientsInPipeline = useMemo(() => new Set(clients.filter(c => c.cliente_id).map(c => c.cliente_id!)), [clients]);
  
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
        if (c.is_lead) {
          return c.lead_name?.toLowerCase().includes(q) || c.lead_produto?.toLowerCase().includes(q) || c.lead_email?.toLowerCase().includes(q);
        }
        return c.cliente?.nome?.toLowerCase().includes(q) || 
               c.cliente?.produto?.toLowerCase().includes(q) ||
               c.cliente?.email?.toLowerCase().includes(q);
      });
  };

  const handleAddClient = async (stageId: string) => {
    if (isReadOnly || !onMoveClient) return;
    if (!selectedClient) return;
    setMovingClient(selectedClient);
    await onMoveClient(selectedClient, stageId);
    setSelectedClient('');
    setAddingToStage(null);
    setMovingClient(null);
  };

  const [convertTargetStageId, setConvertTargetStageId] = useState<string | null>(null);

  const handleMoveItem = async (pc: PipelineClient, newStageId: string, targetStageName: string) => {
    // Check if lead is being moved to "Ativo" stage — block move, prompt conversion first
    if (pc.is_lead && targetStageName.toLowerCase() === 'ativo') {
      setConvertingLead(pc);
      setConvertTargetStageId(newStageId);
      return; // Do NOT move yet — only move after successful conversion
    }
    
    if (pc.is_lead || !pc.cliente_id) {
      await onMovePipelineItem(pc.id, newStageId);
    } else {
      await onMoveClient(pc.cliente_id, newStageId);
    }
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

  const leadsCount = clients.filter(c => c.is_lead).length;
  const registeredCount = clients.filter(c => !c.is_lead).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou lead..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} title="Atualizar dados">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {registeredCount} clientes · {leadsCount} leads · {allClients.length} total
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
                {!isReadOnly && (
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Adicionar lead"
                      onClick={() => setLeadFormStage(stage.id)}
                    >
                      <UserRoundPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title="Adicionar cliente existente"
                      onClick={() => setAddingToStage(addingToStage === stage.id ? null : stage.id)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Add client widget */}
              {!isReadOnly && addingToStage === stage.id && (
                <div className="p-2 border-b border-border bg-card/50">
                  <Popover open={comboOpen} onOpenChange={setComboOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={comboOpen} className="w-full h-8 text-xs bg-secondary border-border mb-1.5 justify-between font-normal">
                        {selectedClient
                          ? availableClients.find(c => c.id === selectedClient)?.nome || 'Selecionar...'
                          : 'Buscar cliente...'}
                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 bg-card border-border z-[9999]" align="start">
                      <Command>
                        <CommandInput placeholder="Pesquisar por nome..." className="h-8 text-xs" />
                        <CommandList>
                          <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">Nenhum cliente encontrado</CommandEmpty>
                          <CommandGroup>
                            {availableClients.map(c => {
                              const tipo = c.cobranca_ativa === false ? 'Registro' : 'Mensal';
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.nome} ${c.produto} ${tipo}`}
                                  onSelect={() => { setSelectedClient(c.id); setComboOpen(false); }}
                                  className="text-xs gap-2"
                                >
                                  <Check className={cn("h-3 w-3 shrink-0", selectedClient === c.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex-1 min-w-0">
                                    <span className="truncate">{c.nome}</span>
                                    <span className="text-muted-foreground ml-1">— {c.produto}</span>
                                  </div>
                                  <Badge variant={tipo === 'Registro' ? 'secondary' : 'outline'} className="text-[9px] px-1 py-0 shrink-0">
                                    {tipo}
                                  </Badge>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                    const isLead = pc.is_lead || !pc.cliente;
                    const name = isLead ? pc.lead_name : pc.cliente?.nome;
                    const product = isLead ? pc.lead_produto : pc.cliente?.produto;
                    
                    return (
                      <Card
                        key={pc.id}
                        className={cn(
                          "p-3 bg-card border-border hover:border-primary/30 transition-colors cursor-default group",
                          isLead && "border-l-2 border-l-amber-500/60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-sm text-foreground truncate">{name || 'Sem nome'}</p>
                              {isLead && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/50 text-amber-600">Lead</Badge>
                              )}
                            </div>
                            {product && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3 shrink-0" />
                                <span className="truncate">{product}</span>
                              </div>
                            )}
                            {isLead && pc.lead_email && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{pc.lead_email}</p>
                            )}
                          </div>
                          {!isReadOnly && (
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
                                    onClick={() => handleMoveItem(pc, s.id, s.name)}
                                    className="text-xs gap-2"
                                  >
                                    <ArrowRight className="h-3 w-3" />
                                    Mover para {s.name}
                                  </DropdownMenuItem>
                                ))}
                                {isLead && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setConvertingLead(pc)}
                                      className="text-xs gap-2 text-primary"
                                    >
                                      <ArrowRightCircle className="h-3 w-3" />
                                      Cadastrar como cliente
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onRemoveClient?.(pc.id)}
                                  className="text-xs gap-2 text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Remover do pipeline
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        {!isLead && pc.cliente && (
                          <>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <Badge variant={getRenewalStatus(pc.cliente.data_renovacao).variant} className="text-[10px] px-1.5 py-0">
                                <Calendar className="h-2.5 w-2.5 mr-0.5" />
                                {getRenewalStatus(pc.cliente.data_renovacao).label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <DollarSign className="h-2.5 w-2.5" />
                                {pc.cliente.moeda === 'USD' ? '$' : 'R$'} {Number(pc.cliente.valor).toFixed(2)}
                              </span>
                            </div>

                            {pc.cliente.tags && pc.cliente.tags.length > 0 && (
                              <div className="mt-1.5 flex gap-1 flex-wrap">
                                {pc.cliente.tags.slice(0, 3).map(tag => (
                                  <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </>
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

      {/* Lead Form Dialog */}
      {!isReadOnly && (
        <>
          <LeadFormDialog
            open={!!leadFormStage}
            onOpenChange={(open) => !open && setLeadFormStage(null)}
            onSubmit={async (lead) => {
              if (leadFormStage) await onAddLead?.(leadFormStage, lead);
            }}
          />

          <ConvertLeadDialog
            open={!!convertingLead}
            onOpenChange={(open) => {
              if (!open) {
                setConvertingLead(null);
                setConvertTargetStageId(null);
              }
            }}
            lead={convertingLead ? {
              id: convertingLead.id,
              lead_name: convertingLead.lead_name || '',
              lead_phone: convertingLead.lead_phone || '',
              lead_email: convertingLead.lead_email || '',
              lead_produto: convertingLead.lead_produto || '',
            } : null}
            onConvert={async (data) => {
              await onConvertLead?.(data);
              // After successful conversion, move to Ativo stage
              if (convertTargetStageId && convertingLead) {
                await onMovePipelineItem?.(convertingLead.id, convertTargetStageId);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
