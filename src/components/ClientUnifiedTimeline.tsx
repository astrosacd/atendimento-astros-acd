import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  History, CreditCard, Mail, FileText, CheckSquare, ShoppingBag, 
  File, RefreshCw, ChevronDown, AlertTriangle, Send, MessageSquare,
  Clock, ArrowUpDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimelineEvent {
  id: string;
  type: 'history' | 'billing' | 'payment' | 'followup' | 'proposal' | 'task' | 'purchase' | 'file' | 'recovery';
  date: string;
  title: string;
  description: string;
  status?: string;
  metadata?: Record<string, any>;
}

interface ClientUnifiedTimelineProps {
  clienteId: string;
  clienteName: string;
}

const TYPE_CONFIG: Record<TimelineEvent['type'], { icon: React.ElementType; color: string; label: string }> = {
  history: { icon: History, color: 'text-info', label: 'Alteração' },
  billing: { icon: Mail, color: 'text-amber-500', label: 'Cobrança' },
  payment: { icon: CreditCard, color: 'text-primary', label: 'Pagamento' },
  followup: { icon: Send, color: 'text-violet-500', label: 'Follow-up' },
  proposal: { icon: FileText, color: 'text-blue-500', label: 'Proposta' },
  task: { icon: CheckSquare, color: 'text-emerald-500', label: 'Tarefa' },
  purchase: { icon: ShoppingBag, color: 'text-orange-500', label: 'Compra' },
  file: { icon: File, color: 'text-cyan-500', label: 'Arquivo' },
  recovery: { icon: AlertTriangle, color: 'text-red-500', label: 'Recuperação' },
};

export function ClientUnifiedTimeline({ clienteId, clienteName }: ClientUnifiedTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (clienteId) {
      loadAllEvents();
    }
  }, [clienteId]);

  const loadAllEvents = async () => {
    setLoading(true);
    try {
      const [
        historyRes,
        billingRes,
        paymentsRes,
        followupsRes,
        tasksRes,
        purchasesRes,
        filesRes,
        recoveryRes,
      ] = await Promise.all([
        supabase.from('client_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('billing_logs').select('*').eq('cliente_id', clienteId).order('sent_at', { ascending: false }).limit(50),
        supabase.from('client_payments').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_followups').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_tasks').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_purchases').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_files').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_recovery_attempts').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
      ]);

      const allEvents: TimelineEvent[] = [];

      // Client history
      (historyRes.data || []).forEach((h: any) => {
        const actionLabels: Record<string, string> = { created: 'Cliente cadastrado', updated: 'Cliente atualizado', deleted: 'Cliente excluído' };
        allEvents.push({
          id: `history-${h.id}`,
          type: 'history',
          date: h.created_at,
          title: actionLabels[h.action] || h.action,
          description: h.changed_fields?.length ? `Campos: ${h.changed_fields.join(', ')}` : (h.changed_by_email ? `Por: ${h.changed_by_email}` : ''),
          status: h.action,
        });
      });

      // Billing logs
      (billingRes.data || []).forEach((b: any) => {
        const statusLabels: Record<string, string> = { sent: 'Enviado', error: 'Erro', pending: 'Pendente' };
        allEvents.push({
          id: `billing-${b.id}`,
          type: 'billing',
          date: b.sent_at,
          title: `Cobrança ${b.message_type || ''}`.trim(),
          description: `Canal: ${b.channel}${b.error_message ? ` — ${b.error_message}` : ''}`,
          status: b.status,
        });
      });

      // Payments
      (paymentsRes.data || []).forEach((p: any) => {
        const statusLabels: Record<string, string> = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado' };
        allEvents.push({
          id: `payment-${p.id}`,
          type: 'payment',
          date: p.created_at,
          title: `Pagamento ${statusLabels[p.status] || p.status}`,
          description: `R$ ${Number(p.amount).toFixed(2)} — ${p.payment_type}`,
          status: p.status,
        });
      });

      // Follow-ups
      (followupsRes.data || []).forEach((f: any) => {
        const statusLabels: Record<string, string> = { pending: 'Pendente', sent: 'Enviado', completed: 'Concluído', cancelled: 'Cancelado', failed: 'Falhou', resolved: 'Resolvido' };
        allEvents.push({
          id: `followup-${f.id}`,
          type: 'followup',
          date: f.created_at,
          title: `Follow-up: ${f.produto}`,
          description: `Canal: ${f.channel} — ${statusLabels[f.status] || f.status}`,
          status: f.status,
        });
      });

      // Tasks
      (tasksRes.data || []).forEach((t: any) => {
        const statusLabels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' };
        allEvents.push({
          id: `task-${t.id}`,
          type: 'task',
          date: t.created_at,
          title: `Tarefa: ${t.title}`,
          description: `${t.codigo || ''} — ${statusLabels[t.status] || t.status}${t.priority ? ` (${t.priority})` : ''}`,
          status: t.status,
        });
      });

      // Purchases
      (purchasesRes.data || []).forEach((p: any) => {
        allEvents.push({
          id: `purchase-${p.id}`,
          type: 'purchase',
          date: p.created_at,
          title: `Compra: ${p.produto}`,
          description: `${p.moeda === 'USD' ? '$' : 'R$'} ${Number(p.valor).toFixed(2)}${p.descricao ? ` — ${p.descricao}` : ''}`,
        });
      });

      // Files
      (filesRes.data || []).forEach((f: any) => {
        allEvents.push({
          id: `file-${f.id}`,
          type: 'file',
          date: f.created_at,
          title: `Arquivo: ${f.file_name}`,
          description: f.file_type || '',
        });
      });

      // Recovery attempts
      (recoveryRes.data || []).forEach((r: any) => {
        allEvents.push({
          id: `recovery-${r.id}`,
          type: 'recovery',
          date: r.created_at,
          title: `Recuperação — ${r.canal}`,
          description: `${r.status}${r.converteu ? ' ✓ Converteu' : ''}${r.error_message ? ` — ${r.error_message}` : ''}`,
          status: r.status,
        });
      });

      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events
    .filter(e => filter === 'all' || e.type === filter)
    .sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortOrder === 'desc' ? diff : -diff;
    });

  const visibleEvents = filteredEvents.slice(0, visibleCount);

  const getStatusBadgeVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!status) return 'secondary';
    if (['paid', 'sent', 'completed', 'converted', 'resolved', 'created'].includes(status)) return 'default';
    if (['error', 'failed', 'overdue', 'deleted', 'cancelled'].includes(status)) return 'destructive';
    return 'outline';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelative = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return formatDateTime(dateString);
  };

  // Group events by date
  const groupedEvents: Record<string, TimelineEvent[]> = {};
  visibleEvents.forEach(event => {
    const dateKey = new Date(event.date).toLocaleDateString('pt-BR');
    if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
    groupedEvents[dateKey].push(event);
  });

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border text-sm">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos ({events.length})</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => {
              const count = events.filter(e => e.type === key).length;
              if (count === 0) return null;
              return (
                <SelectItem key={key} value={key}>
                  {config.label} ({count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-9 border-border"
          onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
        >
          <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
          {sortOrder === 'desc' ? 'Recentes' : 'Antigos'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 ml-auto"
          onClick={loadAllEvents}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        <span className="text-xs text-muted-foreground">
          {filteredEvents.length} eventos
        </span>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm">Este cliente ainda não possui registros na timeline.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground bg-card px-2">
                    {dateKey}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Events for this date */}
                <div className="space-y-2 relative ml-4">
                  {/* Vertical line */}
                  <div className="absolute left-3 top-4 bottom-4 w-px bg-border" />

                  {dayEvents.map((event) => {
                    const config = TYPE_CONFIG[event.type];
                    const Icon = config.icon;

                    return (
                      <div key={event.id} className="relative flex gap-3 group">
                        {/* Icon dot */}
                        <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-card border border-border shrink-0 ${config.color} group-hover:border-current transition-colors`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {event.title}
                              </p>
                              {event.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {event.status && (
                                <Badge variant={getStatusBadgeVariant(event.status)} className="text-[10px] px-1.5 py-0">
                                  {event.status}
                                </Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatRelative(event.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {visibleCount < filteredEvents.length && (
            <div className="text-center py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount(c => c + 20)}
                className="text-muted-foreground"
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Carregar mais ({filteredEvents.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
