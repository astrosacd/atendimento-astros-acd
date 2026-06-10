import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface Props {
  clienteId: string;
  dataRenovacao?: string;
  cobrancaAtiva?: boolean;
}

type PaymentStatus = 'pending_approval' | 'paid' | 'rejected' | 'overdue' | null;

/**
 * Mostra um badge sobre o último pagamento do cliente que passou pelo
 * fluxo de Segurança de Pagamento (PixPague):
 *  - overdue (calculado)           -> "Pagamento atrasado" (se vencido e mensalidade ativa)
 *  - pending_approval              -> "Aguardando aprovação"
 *  - paid (com approved_by)        -> "Pagamento aprovado"
 *  - rejected                      -> "Pagamento reprovado"
 */
export function ClientPaymentApprovalBadge({ clienteId, dataRenovacao, cobrancaAtiva }: Props) {
  const [status, setStatus] = useState<PaymentStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Se temos data de renovação e cobrança ativa, verificamos se está vencido primeiro
        if (dataRenovacao && cobrancaAtiva !== false) {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const renovacaoStr = String(dataRenovacao).slice(0, 10);
          
          if (renovacaoStr < todayStr) {
            setStatus('overdue');
            setLoading(false);
            return;
          }
        }

        const { data } = await supabase
          .from('client_payments')
          .select('status, approved_by, ocr_status')
          .eq('cliente_id', clienteId)
          .in('status', ['pending_approval', 'paid', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!mounted) return;

        if (!data) {
          setStatus(null);
        } else if (data.status === 'pending_approval') {
          setStatus('pending_approval');
        } else if (data.status === 'rejected') {
          setStatus('rejected');
        } else if (data.status === 'paid' && data.approved_by) {
          // Só mostra "aprovado" se passou por aprovação manual
          setStatus('paid');
        } else {
          setStatus(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clienteId, dataRenovacao, cobrancaAtiva]);

  if (loading || !status) return null;

  if (status === 'overdue') {
    return (
      <Badge
        variant="outline"
        className="bg-red-500/10 text-red-500 border-red-500/30 text-[10px] gap-1"
        title="Este cliente está com a mensalidade atrasada"
      >
        <AlertTriangle className="h-3 w-3" />
        Pagamento atrasado
      </Badge>
    );
  }

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
