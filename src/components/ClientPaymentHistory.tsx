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
  DollarSign,
  QrCode,
  Link as LinkIcon,
  FileText
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
  onPaymentUpdate?: () => void;
}

export function ClientPaymentHistory({ clienteId, clienteName, isOpen, onClose, onPaymentUpdate }: ClientPaymentHistoryProps) {
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
      // Notify parent to refresh client data
      onPaymentUpdate?.();
    }
    setActionLoading(null);
  };

  const handleCancel = async (paymentId: string) => {
    setActionLoading(paymentId);
    const success = await cancelPayment(paymentId);
    if (success) {
      await loadPayments();
      // Notify parent to refresh client data
      onPaymentUpdate?.();
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

  const getPaymentTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pix':
        return <QrCode className="w-4 h-4 text-green-400" />;
      case 'link':
      case 'link_cartao':
      case 'mercadopago':
        return <LinkIcon className="w-4 h-4 text-blue-400" />;
      case 'boleto':
        return <FileText className="w-4 h-4 text-orange-400" />;
      default:
        return <CreditCard className="w-4 h-4 text-primary" />;
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pix':
        return 'PIX';
      case 'link':
      case 'link_cartao':
      case 'mercadopago':
        return 'Link Cartão';
      case 'boleto':
        return 'Boleto';
      default:
        return type;
    }
  };

  const getPaymentTypeBgColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pix':
        return 'bg-green-500/10 border-green-500/30';
      case 'link':
      case 'link_cartao':
      case 'mercadopago':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'boleto':
        return 'bg-orange-500/10 border-orange-500/30';
      default:
        return 'bg-primary/10 border-primary/30';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    // Adiciona timezone para evitar problema de 1 dia a menos
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Group payments by billing_date
  const groupedPayments = payments.reduce((groups, payment) => {
    const date = payment.billing_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(payment);
    return groups;
  }, {} as Record<string, Payment[]>);

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

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <QrCode className="w-3 h-3 text-green-400" /> PIX
              </span>
              <span className="flex items-center gap-1">
                <LinkIcon className="w-3 h-3 text-blue-400" /> Link Cartão
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3 text-orange-400" /> Boleto
              </span>
            </div>

            {/* Payments List - Grouped by Date */}
            {payments.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhum pagamento encontrado
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedPayments)
                  .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                  .map(([date, datePayments]) => (
                    <div key={date} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        Cobrança de {formatDate(date)}
                      </div>
                      <div className="grid gap-2 pl-6">
                        {datePayments.map((payment) => (
                          <div 
                            key={payment.id}
                            className={`p-3 rounded-lg border ${getPaymentTypeBgColor(payment.payment_type)} ${
                              payment.status === 'pending' ? 'ring-1 ring-amber-500/30' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-background/50">
                                  {getPaymentTypeIcon(payment.payment_type)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{getPaymentTypeLabel(payment.payment_type)}</span>
                                    <span className="text-primary font-bold">{formatCurrency(payment.amount)}</span>
                                  </div>
                                  {payment.paid_at && (
                                    <p className="text-xs text-emerald-400">
                                      Pago em {formatDateTime(payment.paid_at)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(payment.status)}
                                {payment.status === 'pending' && (
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-emerald-400 hover:bg-emerald-500/10 h-8 w-8 p-0"
                                      onClick={() => handleMarkAsPaid(payment.id)}
                                      disabled={actionLoading === payment.id}
                                      title="Marcar como pago"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                                      onClick={() => handleCancel(payment.id)}
                                      disabled={actionLoading === payment.id}
                                      title="Cancelar/Recusar"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
