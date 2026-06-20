import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  History, Smartphone, MessageSquare, User, CreditCard, FileText, Download,
  CheckSquare, ShoppingBag, Bell, Key, LifeBuoy, PhoneCall, Receipt,
  CalendarDays, TrendingUp, RefreshCw, FileBarChart,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TimelineEvent {
  id: string;
  type: keyof typeof TYPE_CONFIG;
  date: string;
  title: string;
  description: string;
  status?: string;
}

interface ClientUnifiedTimelineProps {
  clienteId: string;
  clienteName: string;
}

const TYPE_CONFIG = {
  history:   { icon: History,       color: 'text-info',         label: 'Alteração' },
  client:    { icon: User,          color: 'text-blue-500',     label: 'Cadastro' },
  sms:       { icon: MessageSquare, color: 'text-blue-400',     label: 'SMS' },
  rcs:       { icon: Smartphone,    color: 'text-indigo-400',   label: 'RCS' },
  payment:   { icon: CreditCard,    color: 'text-emerald-500',  label: 'Pagamento' },
  proposal:  { icon: FileText,      color: 'text-orange-500',   label: 'Proposta' },
  file:      { icon: Download,      color: 'text-purple-500',   label: 'Arquivo' },
  task:      { icon: CheckSquare,   color: 'text-cyan-500',     label: 'Tarefa' },
  purchase:  { icon: ShoppingBag,   color: 'text-pink-500',     label: 'Compra' },
  followup:  { icon: Bell,          color: 'text-amber-500',    label: 'Follow-up' },
  license:   { icon: Key,           color: 'text-yellow-500',   label: 'Licença' },
  chamado:   { icon: LifeBuoy,      color: 'text-red-500',      label: 'Chamado' },
  ligacao:   { icon: PhoneCall,     color: 'text-green-500',    label: 'Ligação IA' },
  billing:   { icon: Receipt,       color: 'text-rose-500',     label: 'Cobrança' },
  agenda:    { icon: CalendarDays,  color: 'text-violet-500',   label: 'Agenda' },
  score:     { icon: TrendingUp,    color: 'text-teal-500',     label: 'Score' },
  recovery:  { icon: RefreshCw,     color: 'text-orange-400',   label: 'Recuperação' },
  extrato:   { icon: FileBarChart,  color: 'text-amber-500',    label: 'Extrato Investim.' },
} as const;

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos' },
  ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
];

export function ClientUnifiedTimeline({ clienteId }: ClientUnifiedTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(30);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (clienteId) loadAllEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const loadAllEvents = async () => {
    setLoading(true);
    try {
      const s = supabase as any;

      // Fetch base client first (needed for matching by email/phone in some tables)
      const { data: cliente } = await s.from('clientes').select('*').eq('id', clienteId).maybeSingle();
      const clienteEmail: string | null = cliente?.email ?? null;
      const clientePhone: string | null = cliente?.numero ?? null;

      const wrap = (p: any) => p.then((r: any) => r).catch(() => ({ data: [], error: null }));

      const [
        historyRes, smsRes, rcsRes, paymentsRes, proposalsRes,
        tasksRes, filesRes, purchasesRes, followupsRes, licensesRes,
        chamadosRes, ligacoesRes, billingRes, scoresRes, recoveryRes,
        agendaRes, extratoRes,
      ] = await Promise.all([
        wrap(s.from('client_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('sms_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('rcs_messages').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('client_payments').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('proposals').select('*').eq('client_id', clienteId).order('created_at', { ascending: false }).limit(50)),
        wrap(s.from('client_tasks').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('client_files').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('client_purchases').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('client_followups').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('licencas_entregues').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('chamados').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('ligacoes_ia_historico').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(100)),
        wrap(s.from('billing_logs').select('*').eq('cliente_id', clienteId).order('sent_at', { ascending: false }).limit(100)),
        wrap(s.from('client_score_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50)),
        wrap(s.from('client_recovery_attempts').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50)),
        clienteEmail
          ? wrap(s.from('calendar_events').select('*').eq('client_email', clienteEmail).order('start_time', { ascending: false }).limit(50))
          : Promise.resolve({ data: [] }),
        cliente?.nome
          ? wrap(s.from('extrato_investimento_logs').select('*').eq('cliente_nome', cliente.nome).order('created_at', { ascending: false }).limit(50))
          : Promise.resolve({ data: [] }),
      ]);

      const all: TimelineEvent[] = [];

      (historyRes.data || []).forEach((h: any) => all.push({
        id: `history-${h.id}`, type: 'history', date: h.created_at,
        title: `Alteração: ${h.campo || h.field || 'campo'}`,
        description: `De "${h.valor_antigo ?? h.old_value ?? ''}" → "${h.valor_novo ?? h.new_value ?? ''}"`,
      }));

      (smsRes.data || []).forEach((x: any) => all.push({
        id: `sms-${x.id}`, type: 'sms', date: x.created_at,
        title: `SMS ${x.status === 'enviado' ? 'enviado' : x.status === 'erro' ? '(erro)' : `(${x.status})`}`,
        description: x.conteudo || '—', status: x.status,
      }));

      (rcsRes.data || []).forEach((x: any) => all.push({
        id: `rcs-${x.id}`, type: 'rcs', date: x.created_at,
        title: `RCS ${x.status === 'sent' ? 'enviado' : x.status === 'failed' ? '(erro)' : `(${x.status})`}`,
        description: x.message_text || '—', status: x.status,
      }));

      (paymentsRes.data || []).forEach((p: any) => all.push({
        id: `pay-${p.id}`, type: 'payment', date: p.paid_at || p.created_at,
        title: `Pagamento R$ ${Number(p.amount || 0).toFixed(2)} — ${p.status}`,
        description: `Tipo: ${p.payment_type || '—'}${p.receipt_number ? ` · Recibo: ${p.receipt_number}` : ''}`,
        status: p.status,
      }));

      (proposalsRes.data || []).forEach((pr: any) => all.push({
        id: `prop-${pr.id}`, type: 'proposal', date: pr.created_at,
        title: `Proposta: ${pr.title || 'Sem título'}`,
        description: `Status: ${pr.status} · Valor: R$ ${Number(pr.total_value || 0).toFixed(2)}`,
        status: pr.status,
      }));

      (tasksRes.data || []).forEach((t: any) => all.push({
        id: `task-${t.id}`, type: 'task', date: t.created_at,
        title: `Tarefa: ${t.title}`,
        description: `Status: ${t.status} · Prioridade: ${t.priority}${t.due_date ? ` · Vence: ${new Date(t.due_date).toLocaleDateString('pt-BR')}` : ''}`,
        status: t.status,
      }));

      (filesRes.data || []).forEach((f: any) => all.push({
        id: `file-${f.id}`, type: 'file', date: f.created_at,
        title: `Arquivo: ${f.file_name}`,
        description: `${f.file_type || 'arquivo'}${f.file_size ? ` · ${(f.file_size / 1024).toFixed(1)} KB` : ''}`,
      }));

      (purchasesRes.data || []).forEach((c: any) => all.push({
        id: `purc-${c.id}`, type: 'purchase', date: c.data_compra || c.created_at,
        title: `Compra: ${c.produto}`,
        description: `Valor: ${c.moeda} ${Number(c.valor || 0).toFixed(2)}${c.descricao ? ` · ${c.descricao}` : ''}`,
      }));

      (followupsRes.data || []).forEach((f: any) => all.push({
        id: `fup-${f.id}`, type: 'followup', date: f.scheduled_at || f.created_at,
        title: `Follow-up ${f.channel || ''} (${f.status})`,
        description: `Produto: ${f.produto}${f.is_recurring ? ` · recorrente a cada ${f.recurrence_interval_days}d` : ''}`,
        status: f.status,
      }));

      (licensesRes.data || []).forEach((l: any) => all.push({
        id: `lic-${l.id}`, type: 'license', date: l.data_entrega || l.created_at,
        title: `Licença entregue: ${l.ferramenta}`,
        description: `Código: ${l.codigo_licenca} · Origem: ${l.origem}${l.observacao ? ` · ${l.observacao}` : ''}`,
      }));

      (chamadosRes.data || []).forEach((c: any) => all.push({
        id: `cham-${c.id}`, type: 'chamado', date: c.created_at,
        title: `Chamado #${c.codigo} — ${c.status}`,
        description: `${c.motivo}${c.prioridade ? ` · Prioridade: ${c.prioridade}` : ''}`,
        status: c.status,
      }));

      (ligacoesRes.data || []).forEach((l: any) => all.push({
        id: `lig-${l.id}`, type: 'ligacao', date: l.started_at || l.created_at || l.ended_at,
        title: `Ligação IA → ${l.numero_destino} (${l.status})`,
        description: `Tentativa ${l.attempt_number}${l.duration_seconds ? ` · ${l.duration_seconds}s` : ''}${l.error_message ? ` · Erro: ${l.error_message}` : ''}`,
        status: l.status,
      }));

      (billingRes.data || []).forEach((b: any) => all.push({
        id: `bil-${b.id}`, type: 'billing', date: b.sent_at,
        title: `Cobrança ${b.message_type} via ${b.channel} (${b.status})`,
        description: b.error_message || b.resolution_note || '—',
        status: b.status,
      }));

      (scoresRes.data || []).forEach((sc: any) => all.push({
        id: `sc-${sc.id}`, type: 'score', date: sc.created_at,
        title: `Score atualizado: ${sc.score_anterior ?? '?'} → ${sc.score_novo ?? sc.score ?? '?'}`,
        description: sc.motivo || sc.reason || 'Recalculo automático',
      }));

      (recoveryRes.data || []).forEach((r: any) => all.push({
        id: `rec-${r.id}`, type: 'recovery', date: r.created_at,
        title: `Recuperação ${r.channel || ''} (${r.status || 'enviado'})`,
        description: r.message || r.template || '—',
        status: r.status,
      }));

      (agendaRes.data || []).forEach((e: any) => all.push({
        id: `ag-${e.id}`, type: 'agenda', date: e.start_time,
        title: `Agenda: ${e.title}`,
        description: `${new Date(e.start_time).toLocaleString('pt-BR')}${e.location ? ` · ${e.location}` : ''}${e.meet_link ? ' · Meet' : ''}`,
        status: e.status,
      }));

      if (cliente) {
        all.push({
          id: `client-${cliente.id}`, type: 'client', date: cliente.created_at,
          title: `Cliente cadastrado: ${cliente.nome}`,
          description: `${cliente.produto ? `Produto: ${cliente.produto}` : ''}${cliente.email ? ` · ${cliente.email}` : ''}${clientePhone ? ` · ${clientePhone}` : ''}`,
          status: 'Ativo',
        });
      }

      setEvents(all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err) {
      console.error('Error loading timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);
  const counts: Record<string, number> = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Timeline Unificada
          {!loading && <Badge variant="secondary">{events.length} eventos</Badge>}
        </h2>
      </div>

      {!loading && events.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(opt => {
            const n = opt.value === 'all' ? events.length : (counts[opt.value] || 0);
            if (opt.value !== 'all' && n === 0) return null;
            return (
              <Button
                key={opt.value}
                size="sm"
                variant={filter === opt.value ? 'default' : 'outline'}
                onClick={() => setFilter(opt.value)}
                className="h-7 text-xs"
              >
                {opt.label} <span className="ml-1.5 opacity-70">{n}</span>
              </Button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 flex flex-col items-center justify-center text-muted-foreground">
          <History className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-sm">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.slice(0, visibleCount).map((event) => {
              const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.history;
              const Icon = config.icon;
              return (
                <div key={event.id} className="flex gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                  <div className={`mt-1 p-2 rounded-full bg-background border shadow-sm ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-none truncate">{event.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.date).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 break-words">{event.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => v + 30)}>
                Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
