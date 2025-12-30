import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  CreditCard, 
  RefreshCw,
  AlertCircle,
  User
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
  cliente?: {
    nome: string;
    email: string;
  };
}

interface PendingPaymentsListProps {
  onPaymentUpdated?: () => void;
}

export function PendingPaymentsList({ onPaymentUpdated }: PendingPaymentsListProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { markPaymentAsPaid, cancelPayment } = usePaymentStatus();

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_payments')
        .select(`
          *,
          cliente:clientes(nome, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to handle the cliente relation
      const transformedData = (data || []).map(payment => ({
        ...payment,
        cliente: payment.cliente as unknown as { nome: string; email: string } | undefined
      }));
      
      setPayments(transformedData);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    setActionLoading(paymentId);
    const success = await markPaymentAsPaid(paymentId);
    if (success) {
      await loadPayments();
      onPaymentUpdated?.();
    }
    setActionLoading(null);
    setSelectedPayment(null);
  };

  const handleCancel = async (paymentId: string) => {
    setActionLoading(paymentId);
    const success = await cancelPayment(paymentId);
    if (success) {
      await loadPayments();
      onPaymentUpdated?.();
    }
    setActionLoading(null);
    setSelectedPayment(null);
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

  const isStripePayment = (type: string) => 
    type?.toLowerCase().includes('stripe');

  const formatCurrency = (value: number, paymentType: string) => {
    if (isStripePayment(paymentType)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const otherPayments = payments.filter(p => p.status !== 'pending');

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              Gerenciamento de Pagamentos
            </CardTitle>
            <CardDescription>
              {pendingPayments.length} pendente(s) | {payments.length} total
            </CardDescription>
          </div>
          <Button onClick={loadPayments} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : payments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Nenhum pagamento encontrado
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data Cobrança</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Pending payments first */}
                {pendingPayments.map((payment) => (
                  <TableRow key={payment.id} className="bg-amber-500/5 hover:bg-amber-500/10">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{payment.cliente?.nome || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{payment.cliente?.email || ''}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {payment.payment_type === 'mercadopago' ? 'Mercado Pago' : payment.payment_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {formatCurrency(payment.amount, payment.payment_type)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.billing_date)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => setSelectedPayment(payment)}
                          disabled={actionLoading === payment.id}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Pago
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleCancel(payment.id)}
                          disabled={actionLoading === payment.id}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Other payments */}
                {otherPayments.slice(0, 50).map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{payment.cliente?.nome || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{payment.cliente?.email || ''}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {payment.payment_type === 'mercadopago' ? 'Mercado Pago' : payment.payment_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount, payment.payment_type)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(payment.billing_date)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-right">
                      {payment.paid_at && (
                        <span className="text-xs text-muted-foreground">
                          Pago em {formatDate(payment.paid_at)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Confirmar Pagamento
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja marcar este pagamento como pago?
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <p className="font-medium">{selectedPayment.cliente?.nome || 'Cliente'}</p>
                <p className="text-sm text-muted-foreground">{selectedPayment.cliente?.email}</p>
                <p className="text-lg font-bold text-primary mt-2">
                  {formatCurrency(selectedPayment.amount, selectedPayment.payment_type)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                <p className="font-medium text-emerald-400">Ao confirmar:</p>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  <li>• O status será alterado para "Pago"</li>
                  <li>• A data de renovação do cliente será avançada em 1 mês</li>
                  <li>• As datas de cobrança (D-3, D+1, etc.) serão recalculadas</li>
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedPayment(null)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleMarkAsPaid(selectedPayment.id)}
                  disabled={actionLoading === selectedPayment.id}
                >
                  {actionLoading === selectedPayment.id ? 'Processando...' : 'Confirmar Pagamento'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
