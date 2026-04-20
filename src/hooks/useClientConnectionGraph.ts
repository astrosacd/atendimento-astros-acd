import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  category: 'center' | 'compra' | 'proposta' | 'pagamento' | 'cobranca' | 'tarefa' | 'chamado' | 'evento' | 'followup';
  value?: number;
  status?: string;
  date?: string;
}

export interface GraphData {
  center: GraphNode;
  nodes: GraphNode[];
  totals: {
    compras: number;
    propostas: number;
    pagamentos: number;
    cobrancas: number;
    tarefas: number;
    chamados: number;
    eventos: number;
    followups: number;
    valorTotal: number;
  };
}

const fmt = (d?: string | null) => {
  if (!d) return undefined;
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return undefined;
  }
};

const cap = (txt: string, n = 28) => (txt.length > n ? txt.slice(0, n - 1) + '…' : txt);

export function useClientConnectionGraph(clienteId: string | null) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const clienteRes: any = await supabase.from('clientes').select('id, nome, cpf, email, numero, produto, valor, moeda').eq('id', clienteId).maybeSingle();
        const comprasRes: any = await supabase.from('client_purchases').select('id, produto, valor, moeda, data_compra').eq('cliente_id', clienteId).order('data_compra', { ascending: false }).limit(20);
        const propostasRes: any = await supabase.from('proposals').select('id, title, status, total_value, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20);
        const pagamentosRes: any = await supabase.from('client_payments').select('id, amount, status, payment_type, paid_at, billing_date').eq('cliente_id', clienteId).order('billing_date', { ascending: false }).limit(20);
        const cobrancasRes: any = await supabase.from('billing_logs').select('id, message_type, status, channel, sent_at').eq('cliente_id', clienteId).order('sent_at', { ascending: false }).limit(20);
        const tarefasRes: any = await supabase.from('client_tasks').select('id, title, status, priority, due_date, codigo').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20);
        const followupsRes: any = await supabase.from('client_followups').select('id, produto, status, channel, scheduled_at').eq('cliente_id', clienteId).order('scheduled_at', { ascending: false }).limit(20);

        if (cancelled) return;

        const cliente = clienteRes.data;
        if (!cliente) {
          setError('Cliente não encontrado');
          setLoading(false);
          return;
        }

        // Buscar chamados pelo email
        let chamados: any[] = [];
        if (cliente.email) {
          const { data: chamadosData } = await supabase
            .from('chamados')
            .select('id, codigo, motivo, status, prioridade, created_at')
            .eq('email', cliente.email)
            .order('created_at', { ascending: false })
            .limit(20);
          chamados = chamadosData || [];
        }

        // Buscar eventos da agenda pelo email/telefone
        let eventos: any[] = [];
        if (cliente.email || cliente.numero) {
          const orParts: string[] = [];
          if (cliente.email) orParts.push(`client_email.eq.${cliente.email}`);
          if (cliente.numero) orParts.push(`client_phone.eq.${cliente.numero}`);
          const { data: eventosData } = await supabase
            .from('calendar_events')
            .select('id, title, status, start_time, meeting_type')
            .or(orParts.join(','))
            .order('start_time', { ascending: false })
            .limit(20);
          eventos = eventosData || [];
        }

        const center: GraphNode = {
          id: cliente.id,
          label: cliente.nome,
          sublabel: cliente.cpf || cliente.email || cliente.numero || undefined,
          category: 'center',
        };

        const compras = (comprasRes.data || []).map((c: any) => ({
          id: `compra-${c.id}`,
          label: cap(c.produto || 'Compra'),
          sublabel: `${c.moeda} ${Number(c.valor || 0).toFixed(2)}`,
          category: 'compra' as const,
          value: Number(c.valor || 0),
          date: fmt(c.data_compra),
        }));

        const propostas = (propostasRes.data || []).map((p: any) => ({
          id: `proposta-${p.id}`,
          label: cap(p.title || 'Proposta'),
          sublabel: p.status,
          category: 'proposta' as const,
          status: p.status,
          value: Number(p.total_value || 0),
          date: fmt(p.created_at),
        }));

        const pagamentos = (pagamentosRes.data || []).map((p: any) => ({
          id: `pagamento-${p.id}`,
          label: `${p.payment_type || 'Pagamento'}`,
          sublabel: `R$ ${Number(p.amount || 0).toFixed(2)}`,
          category: 'pagamento' as const,
          status: p.status,
          value: Number(p.amount || 0),
          date: fmt(p.paid_at || p.billing_date),
        }));

        const cobrancas = (cobrancasRes.data || []).map((c: any) => ({
          id: `cobranca-${c.id}`,
          label: cap(c.message_type || 'Cobrança'),
          sublabel: `${c.channel} • ${c.status}`,
          category: 'cobranca' as const,
          status: c.status,
          date: fmt(c.sent_at),
        }));

        const tarefas = (tarefasRes.data || []).map((t: any) => ({
          id: `tarefa-${t.id}`,
          label: cap(t.title || 'Tarefa'),
          sublabel: t.codigo ? `${t.codigo} • ${t.status}` : t.status,
          category: 'tarefa' as const,
          status: t.status,
          date: fmt(t.due_date),
        }));

        const chamadosNodes = chamados.map((ch: any) => ({
          id: `chamado-${ch.id}`,
          label: cap(ch.motivo || ch.codigo || 'Chamado'),
          sublabel: `${ch.codigo} • ${ch.status}`,
          category: 'chamado' as const,
          status: ch.status,
          date: fmt(ch.created_at),
        }));

        const eventosNodes = eventos.map((e: any) => ({
          id: `evento-${e.id}`,
          label: cap(e.title || 'Evento'),
          sublabel: `${e.meeting_type || ''} • ${e.status}`.trim(),
          category: 'evento' as const,
          status: e.status,
          date: fmt(e.start_time),
        }));

        const followups = (followupsRes.data || []).map((f: any) => ({
          id: `followup-${f.id}`,
          label: cap(f.produto || 'Follow-up'),
          sublabel: `${f.channel} • ${f.status}`,
          category: 'followup' as const,
          status: f.status,
          date: fmt(f.scheduled_at),
        }));

        const allNodes = [
          ...compras,
          ...propostas,
          ...pagamentos,
          ...cobrancas,
          ...tarefas,
          ...chamadosNodes,
          ...eventosNodes,
          ...followups,
        ];

        const valorTotal =
          compras.reduce((s, n) => s + (n.value || 0), 0) +
          pagamentos
            .filter((p) => p.status === 'approved' || p.status === 'paid')
            .reduce((s, n) => s + (n.value || 0), 0);

        setData({
          center,
          nodes: allNodes,
          totals: {
            compras: compras.length,
            propostas: propostas.length,
            pagamentos: pagamentos.length,
            cobrancas: cobrancas.length,
            tarefas: tarefas.length,
            chamados: chamadosNodes.length,
            eventos: eventosNodes.length,
            followups: followups.length,
            valorTotal,
          },
        });
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Erro ao carregar dados');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  return { data, loading, error };
}
