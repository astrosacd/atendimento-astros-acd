import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  History, Smartphone, MessageSquare, User, Search
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TimelineEvent {
  id: string;
  type: 'client' | 'sms' | 'rcs' | 'history';
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

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  history: { icon: History, color: 'text-info', label: 'Alteração' },
  client: { icon: User, color: 'text-blue-500', label: 'Cadastro' },
  sms: { icon: MessageSquare, color: 'text-blue-400', label: 'SMS Enviado' },
  rcs: { icon: Smartphone, color: 'text-indigo-400', label: 'RCS Enviado' },
};

export function ClientUnifiedTimeline({ clienteId, clienteName }: ClientUnifiedTimelineProps) {
  const { canViewClientAI } = usePermissions();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (clienteId) {
      loadAllEvents();
    }
  }, [clienteId]);

  const loadAllEvents = async () => {
    setLoading(true);
    try {
      // Use 'as any' to bypass the deep type instantiation issues with the Supabase client
      const s = supabase as any;
      
      const [historyRes, clientDataRes, smsHistoryRes, rcsHistoryRes] = await Promise.all([
        s.from('client_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        s.from('clientes').select('*').eq('id', clienteId).single(),
        s.from('sms_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        s.from('rcs_messages').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
      ]);

      const allEvents: TimelineEvent[] = [];

      // RCS History
      (rcsHistoryRes.data || []).forEach((r: any) => {
        allEvents.push({
          id: `rcs-${r.id}`,
          type: 'rcs',
          date: r.created_at,
          title: `RCS: ${r.status === 'sent' ? 'Enviado' : (r.status === 'failed' ? 'Erro' : 'Pendente')}`,
          description: r.message_text,
          status: r.status,
          metadata: { error: r.error_message }
        });
      });

      // SMS History
      (smsHistoryRes.data || []).forEach((s: any) => {
        allEvents.push({
          id: `sms-${s.id}`,
          type: 'sms',
          date: s.created_at,
          title: `SMS: ${s.status === 'enviado' ? 'Enviado' : 'Erro'}`,
          description: s.conteudo,
          status: s.status,
          metadata: { error: s.error_message }
        });
      });

      // Client Base Info
      if (clientDataRes.data) {
        const c = clientDataRes.data;
        allEvents.push({
          id: `client-base-${c.id}`,
          type: 'client',
          date: c.created_at,
          title: `Cliente Cadastrado: ${c.nome}`,
          description: `${c.produto ? `Produto: ${c.produto}` : ''}${c.email ? ` — Email: ${c.email}` : ''}${c.numero ? ` — Tel: ${c.numero}` : ''}`,
          status: 'Ativo',
        });
      }

      setEvents(allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err) {
      console.error('Error loading timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Timeline Unificada (RCS e SMS)
        </h2>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 flex flex-col items-center justify-center text-muted-foreground">
          <History className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-sm">Nenhum registro encontrado para este cliente.</p>
        </div>
      ) : (
        <div className="space-y-4">
           {events.slice(0, visibleCount).map((event) => {
             const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.history;
             const Icon = config.icon;
             return (
               <div key={event.id} className="flex gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                 <div className={"mt-1 p-2 rounded-full bg-background border shadow-sm " + config.color}>
                   <Icon className="h-4 w-4" />
                 </div>
                 <div className="flex-1 space-y-1">
                   <div className="flex items-center justify-between">
                     <p className="text-sm font-medium leading-none">{event.title}</p>
                     <span className="text-xs text-muted-foreground">
                       {new Date(event.date).toLocaleString('pt-BR')}
                     </span>
                   </div>
                   <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                 </div>
               </div>
             );
           })}
        </div>
      )}
    </div>
  );
}
