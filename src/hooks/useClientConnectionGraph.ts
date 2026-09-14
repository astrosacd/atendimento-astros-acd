import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type GraphCategory =
  | 'center'
  | 'compra'
  | 'proposta'
  | 'pagamento'
  | 'cobranca'
  | 'tarefa'
  | 'chamado'
  | 'evento'
  | 'followup'
  | 'licenca'
  | 'arquivo'
  | 'logo'
  | 'credencial'
  | 'recuperacao'
  | 'historico'
  | 'ia'
  | 'grupo';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  category: GraphCategory;
  value?: number;
  status?: string;
  date?: string;
}

export interface GraphTotals {
  compras: number;
  propostas: number;
  pagamentos: number;
  cobrancas: number;
  tarefas: number;
  chamados: number;
  eventos: number;
  followups: number;
  licencas: number;
  arquivos: number;
  logos: number;
  credenciais: number;
  recuperacoes: number;
  historicos: number;
  ias: number;
  grupos: number;
  valorTotal: number;
}

export interface GraphData {
  center: GraphNode;
  nodes: GraphNode[];
  totals: GraphTotals;
}

const fmt = (d?: string | null) => {
  if (!d) return undefined;
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return undefined;
  }
};

const cap = (txt: string, n = 24) => (txt.length > n ? txt.slice(0, n - 1) + '…' : txt);

export type ClienteSituacao = 'cancelado' | 'inadimplente' | 'agendado' | 'registro' | 'ativo';

const RECURRING_CYCLES = ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];

export function hasCanceladoTag(cliente: any): boolean {
  return Array.isArray(cliente?.tags)
    && cliente.tags.some((t: any) => String(t || '').toLowerCase() === 'cancelado');
}

export function resolveClienteSituacao(cliente: any): ClienteSituacao {
  // 1) Agendado: serviço marcado, ainda não retirado
  if (cliente?.status_cliente === 'agendado') return 'agendado';

  // 2) Cancelado: data formal de cancelamento OU tag 'cancelado' + cobrança desligada
  if (cliente?.cancelado_em) return 'cancelado';
  if (cliente?.cobranca_ativa === false && hasCanceladoTag(cliente)) return 'cancelado';

  // 3) Registro / venda única: cobrança desligada e sem cancelamento
  if (cliente?.cobranca_ativa === false) return 'registro';

  const ciclo = String(cliente?.ciclo_cobranca || '').trim().toLowerCase();
  if (!RECURRING_CYCLES.includes(ciclo)) return 'registro';

  // 4) Inadimplente: recorrente ativo com renovação vencida
  if (cliente?.data_renovacao) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [y, m, d] = String(cliente.data_renovacao).split('-').map(Number);
    if (y && m && d) {
      const renovacao = new Date(y, m - 1, d);
      if (renovacao < hoje) return 'inadimplente';
    }
  }

  return 'ativo';
}


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
        const sb: any = supabase;

        const [
          clienteRes,
          comprasRes,
          propostasRes,
          pagamentosRes,
          cobrancasRes,
          tarefasRes,
          followupsRes,
          licencasRes,
          arquivosRes,
          logosRes,
          credenciaisRes,
          recuperacoesRes,
          historicoRes,
          iaRes,
          gruposRes,
        ] = await Promise.all([
          sb.from('clientes').select('id, nome, cpf, email, numero, produto, valor, moeda, status_cliente, cobranca_ativa, ciclo_cobranca, cancelado_em, data_renovacao, data_agendamento').eq('id', clienteId).maybeSingle(),
          sb.from('client_purchases').select('id, produto, valor, moeda, data_compra').eq('cliente_id', clienteId).order('data_compra', { ascending: false }).limit(30),
          sb.from('proposals').select('id, title, status, total_value, created_at').eq('client_id', clienteId).order('created_at', { ascending: false }).limit(30),
          sb.from('client_payments').select('id, amount, status, payment_type, paid_at, billing_date').eq('cliente_id', clienteId).order('billing_date', { ascending: false }).limit(30),
          sb.from('billing_logs').select('id, message_type, status, channel, sent_at').eq('cliente_id', clienteId).order('sent_at', { ascending: false }).limit(30),
          sb.from('client_tasks').select('id, title, status, priority, due_date, codigo').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(30),
          sb.from('client_followups').select('id, produto, status, channel, scheduled_at').eq('cliente_id', clienteId).order('scheduled_at', { ascending: false }).limit(30),
          sb.from('licencas_entregues').select('id, produto, chave_licenca, status, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20),
          sb.from('client_files').select('id, file_name, file_type, file_size, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20),
          sb.from('client_logos').select('id, file_name, description, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(15),
          sb.from('client_social_credentials').select('id, platform, login, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20),
          sb.from('client_recovery_attempts').select('id, canal, status, data_envio, converteu').eq('cliente_id', clienteId).order('data_envio', { ascending: false }).limit(20),
          sb.from('client_history').select('id, action, changed_by_email, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(15),
          sb.from('client_ai_logs').select('id, mode, model, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(15),
          sb.from('client_whatsapp_groups').select('id, group_name, status, created_at').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(15),
        ]);

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
          const { data: chamadosData } = await sb
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
          const { data: eventosData } = await sb
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
          status: resolveClienteSituacao(cliente),
          date: cliente.cancelado_em
            ? fmt(cliente.cancelado_em)
            : cliente.status_cliente === 'agendado'
              ? fmt(cliente.data_agendamento)
              : fmt(cliente.data_renovacao),
        };

        const compras: GraphNode[] = (comprasRes.data || []).map((c: any) => ({
          id: `compra-${c.id}`,
          label: cap(c.produto || 'Compra'),
          sublabel: `${c.moeda} ${Number(c.valor || 0).toFixed(2)}`,
          category: 'compra',
          value: Number(c.valor || 0),
          date: fmt(c.data_compra),
        }));

        const propostas: GraphNode[] = (propostasRes.data || []).map((p: any) => ({
          id: `proposta-${p.id}`,
          label: cap(p.title || 'Proposta'),
          sublabel: p.status,
          category: 'proposta',
          status: p.status,
          value: Number(p.total_value || 0),
          date: fmt(p.created_at),
        }));

        const pagamentos: GraphNode[] = (pagamentosRes.data || []).map((p: any) => ({
          id: `pagamento-${p.id}`,
          label: cap(p.payment_type || 'Pagamento'),
          sublabel: `R$ ${Number(p.amount || 0).toFixed(2)} • ${p.status}`,
          category: 'pagamento',
          status: p.status,
          value: Number(p.amount || 0),
          date: fmt(p.paid_at || p.billing_date),
        }));

        const cobrancas: GraphNode[] = (cobrancasRes.data || []).map((c: any) => ({
          id: `cobranca-${c.id}`,
          label: cap(c.message_type || 'Cobrança'),
          sublabel: `${c.channel} • ${c.status}`,
          category: 'cobranca',
          status: c.status,
          date: fmt(c.sent_at),
        }));

        const tarefas: GraphNode[] = (tarefasRes.data || []).map((t: any) => ({
          id: `tarefa-${t.id}`,
          label: cap(t.title || 'Tarefa'),
          sublabel: t.codigo ? `${t.codigo} • ${t.status}` : t.status,
          category: 'tarefa',
          status: t.status,
          date: fmt(t.due_date),
        }));

        const followups: GraphNode[] = (followupsRes.data || []).map((f: any) => ({
          id: `followup-${f.id}`,
          label: cap(f.produto || 'Follow-up'),
          sublabel: `${f.channel} • ${f.status}`,
          category: 'followup',
          status: f.status,
          date: fmt(f.scheduled_at),
        }));

        const licencas: GraphNode[] = (licencasRes.data || []).map((l: any) => ({
          id: `licenca-${l.id}`,
          label: cap(l.produto || 'Licença'),
          sublabel: l.chave_licenca ? cap(l.chave_licenca, 16) : l.status,
          category: 'licenca',
          status: l.status,
          date: fmt(l.created_at),
        }));

        const arquivos: GraphNode[] = (arquivosRes.data || []).map((a: any) => ({
          id: `arquivo-${a.id}`,
          label: cap(a.file_name || 'Arquivo'),
          sublabel: a.file_type || undefined,
          category: 'arquivo',
          date: fmt(a.created_at),
        }));

        const logos: GraphNode[] = (logosRes.data || []).map((l: any) => ({
          id: `logo-${l.id}`,
          label: cap(l.file_name || 'Logo'),
          sublabel: l.description ? cap(l.description, 20) : undefined,
          category: 'logo',
          date: fmt(l.created_at),
        }));

        const credenciais: GraphNode[] = (credenciaisRes.data || []).map((c: any) => ({
          id: `cred-${c.id}`,
          label: cap(c.platform || 'Credencial'),
          sublabel: cap(c.login || '', 20),
          category: 'credencial',
          date: fmt(c.created_at),
        }));

        const recuperacoes: GraphNode[] = (recuperacoesRes.data || []).map((r: any) => ({
          id: `rec-${r.id}`,
          label: r.converteu ? 'Recuperado' : cap(r.canal || 'Tentativa'),
          sublabel: `${r.canal} • ${r.status}`,
          category: 'recuperacao',
          status: r.status,
          date: fmt(r.data_envio),
        }));

        const historicos: GraphNode[] = (historicoRes.data || []).map((h: any) => ({
          id: `hist-${h.id}`,
          label: cap(h.action || 'Alteração'),
          sublabel: h.changed_by_email ? cap(h.changed_by_email, 20) : undefined,
          category: 'historico',
          date: fmt(h.created_at),
        }));

        const ias: GraphNode[] = (iaRes.data || []).map((i: any) => ({
          id: `ia-${i.id}`,
          label: cap(i.mode || 'IA'),
          sublabel: i.model ? cap(i.model, 18) : undefined,
          category: 'ia',
          date: fmt(i.created_at),
        }));

        const grupos: GraphNode[] = (gruposRes.data || []).map((g: any) => ({
          id: `grupo-${g.id}`,
          label: cap(g.group_name || 'Grupo WhatsApp'),
          sublabel: g.status,
          category: 'grupo',
          status: g.status,
          date: fmt(g.created_at),
        }));

        const chamadosNodes: GraphNode[] = chamados.map((ch: any) => ({
          id: `chamado-${ch.id}`,
          label: cap(ch.motivo || ch.codigo || 'Chamado'),
          sublabel: `${ch.codigo} • ${ch.status}`,
          category: 'chamado',
          status: ch.status,
          date: fmt(ch.created_at),
        }));

        const eventosNodes: GraphNode[] = eventos.map((e: any) => ({
          id: `evento-${e.id}`,
          label: cap(e.title || 'Evento'),
          sublabel: `${e.meeting_type || ''} • ${e.status}`.trim(),
          category: 'evento',
          status: e.status,
          date: fmt(e.start_time),
        }));

        const allNodes: GraphNode[] = [
          ...compras,
          ...propostas,
          ...pagamentos,
          ...cobrancas,
          ...tarefas,
          ...chamadosNodes,
          ...eventosNodes,
          ...followups,
          ...licencas,
          ...arquivos,
          ...logos,
          ...credenciais,
          ...recuperacoes,
          ...historicos,
          ...ias,
          ...grupos,
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
            licencas: licencas.length,
            arquivos: arquivos.length,
            logos: logos.length,
            credenciais: credenciais.length,
            recuperacoes: recuperacoes.length,
            historicos: historicos.length,
            ias: ias.length,
            grupos: grupos.length,
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
