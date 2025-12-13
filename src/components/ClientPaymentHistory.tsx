import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Calendar,
  DollarSign
} from 'lucide-react';

interface Payment {
  id: string;
  cliente_id: string | null;
  payment_id: string;
  preference_id: string | null;
  payment_type: string;
  amount: number;
  status: string;
  paid_at: string | null;
  billing_date: string;
  created_at: string;
}

interface ClientPaymentHistoryProps {
  clienteId: string;
  clienteName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ClientPaymentHistory({ clienteId, clienteName, isOpen, onClose }: ClientPaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { fetchClientPayments, markPaymentAsPaid, cancelPayment } = usePaymentStatus();

  useEffect(() => {
    if (isOpen && clienteId) {
      loadPayments();
    }
  }, [isOpen, clienteId]);

  const loadPayments = async () => {
    setIsLoading(true);
    const data = await fetchClientPayments(clienteId);
    setPayments(data);
    setIsLoading(false);
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    setActionLoading(paymentId);
    const success = await markPaymentAsPaid(paymentId);
    if (success) {
      await loadPayments();
    }
    setActionLoading(null);
  };

  const handleCancel = async (paymentId: string) => {
    setActionLoading(paymentId);
    const success = await cancelPayment(paymentId);
    if (success) {
      await loadPayments();
    }
    setActionLoading(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.status === 'paid').length,
    pending: payments.filter(p => p.status === 'pending').length,
    totalPaid: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Histórico de Pagamentos
          </DialogTitle>
          <DialogDescription>
            {clienteName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 rounded-lg bg-secondary/50 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{stats.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xs text-muted-foreground">Pagos</p>
                <p className="text-lg font-bold text-emerald-400">{stats.paid}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-lg font-bold text-amber-400">{stats.pending}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground">Total Pago</p>
                <p className="text-sm font-bold text-primary">{formatCurrency(stats.totalPaid)}</p>
              </div>
            </div>

            {/* Payments List */}
            {payments.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhum pagamento encontrado
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div 
                    key={payment.id}
                    className={`p-4 rounded-lg border ${
                      payment.status === 'pending' 
                        ? 'bg-amber-500/5 border-amber-500/20' 
                        : payment.status === 'paid'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-secondary/50 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background">
                          <DollarSign className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-primary">{formatCurrency(payment.amount)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>Cobrança: {formatDate(payment.billing_date)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(payment.status)}
                        {payment.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => handleMarkAsPaid(payment.id)}
                              disabled={actionLoading === payment.id}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:bg-red-500/10"
                              onClick={() => handleCancel(payment.id)}
                              disabled={actionLoading === payment.id}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {payment.paid_at && (
                      <p className="text-xs text-emerald-400 mt-2">
                        Pago em {formatDate(payment.paid_at)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      ID: {payment.payment_id} | Tipo: {payment.payment_type === 'mercadopago' ? 'Mercado Pago' : payment.payment_type}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
