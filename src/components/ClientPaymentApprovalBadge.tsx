import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  clienteId: string;
}

type PaymentStatus = 'pending_approval' | 'paid' | 'rejected' | null;

const CICLO_MESES: Record<string, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/**
 * Mostra um badge sobre o pagamento do CICLO ATUAL do cliente.
 *  - pending_approval -> "Aguardando aprovação"
 *  - paid (com approved_by) -> "Pagamento aprovado"
 *  - rejected -> "Pagamento reprovado"
 *
 * Regras:
 *  - O badge só considera pagamentos do CICLO VIGENTE (entre o início do ciclo
 *    atual e a data de renovação). Pagamentos de ciclos anteriores são ignorados.
 *  - Se o cliente está atrasado (data_renovacao < hoje), o ciclo atual é o novo
 *    que começou em data_renovacao — como ainda não pagou, nenhum badge aparece.
 *  - O "mais recente" é escolhido por updated_at (refletindo a última ação de
 *    aprovação/rejeição), não pelo created_at, para que reenvios atualizem o status.
 */
export function ClientPaymentApprovalBadge({ clienteId }: Props) {
  const [status, setStatus] = useState<PaymentStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        // 1) Buscar dados de ciclo do cliente
        const { data: cliente } = await supabase
          .from('clientes')
          .select('data_renovacao, ciclo_cobranca')
          .eq('id', clienteId)
          .maybeSingle();

        // 2) Calcular janela do ciclo atual
        let cycleStart: Date | null = null;
        let cycleEnd: Date | null = null;
        if (cliente?.data_renovacao) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const renovacao = new Date(`${cliente.data_renovacao}T00:00:00`);
          const meses = CICLO_MESES[cliente.ciclo_cobranca ?? 'mensal'] ?? 1;

          if (renovacao.getTime() >= today.getTime()) {
            // Em dia: ciclo atual = (renovacao - meses, renovacao]
            cycleEnd = renovacao;
            cycleStart = new Date(renovacao);
            cycleStart.setMonth(cycleStart.getMonth() - meses);
          } else {
            // Atrasado: ciclo atual começou em data_renovacao
            cycleStart = renovacao;
            cycleEnd = new Date(renovacao);
            cycleEnd.setMonth(cycleEnd.getMonth() + meses);
          }
        }

        // 3) Buscar pagamentos relevantes, ordenando pela última ação (updated_at)
        const { data } = await supabase
          .from('client_payments')
          .select('status, approved_by, updated_at, created_at, paid_at')
          .eq('cliente_id', clienteId)
          .in('status', ['pending_approval', 'paid', 'rejected'])
          .order('updated_at', { ascending: false })
          .limit(20);

        if (!mounted) return;

        // 4) Filtrar pelo ciclo atual (se possível) e pegar o mais recente
        const inCycle = (data ?? []).filter((p: any) => {
          if (!cycleStart) return true; // sem ciclo definido, mantém tudo
          const ref = new Date(p.paid_at ?? p.updated_at ?? p.created_at);
          if (cycleEnd && ref.getTime() > cycleEnd.getTime() + 24 * 60 * 60 * 1000) return false;
          return ref.getTime() >= cycleStart.getTime();
        });

        const latest = inCycle[0];

        if (!latest) {
          setStatus(null);
        } else if (latest.status === 'pending_approval') {
          setStatus('pending_approval');
        } else if (latest.status === 'rejected') {
          setStatus('rejected');
        } else if (latest.status === 'paid' && latest.approved_by) {
          setStatus('paid');
        } else {
          setStatus(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    // Realtime: refletir reenvios/aprovações sem refresh
    const channel = supabase
      .channel(`client-payment-badge-${clienteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_payments', filter: `cliente_id=eq.${clienteId}` },
        () => {
          if (mounted) load();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [clienteId]);

  if (loading || !status) return null;

  if (status === 'pending_approval') {
    return (
      <Badge
        variant="outline"
        className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-[10px] gap-1"
        title="O comprovante deste cliente está aguardando análise no módulo Segurança de Pagamento"
      >
        <Clock className="h-3 w-3" />
        Aguardando aprovação
      </Badge>
    );
  }

  if (status === 'paid') {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] gap-1"
        title="Pagamento aprovado no módulo Segurança de Pagamento"
      >
        <CheckCircle2 className="h-3 w-3" />
        Pagamento aprovado
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-red-500/10 text-red-500 border-red-500/30 text-[10px] gap-1"
      title="Pagamento reprovado no módulo Segurança de Pagamento"
    >
      <XCircle className="h-3 w-3" />
      Pagamento reprovado
    </Badge>
  );
}
