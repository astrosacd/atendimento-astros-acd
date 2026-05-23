import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Calendar,
  QrCode,
  Link as LinkIcon,
  FileText,
  Receipt,
  Plus
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
  receipt_number: string | null;
  comprovante_url?: string | null;
}

interface ClientPaymentHistoryProps {
  clienteId: string;
  clienteName: string;
  isOpen: boolean;
  onClose: () => void;
  onPaymentUpdate?: () => void;
}

// Helper to determine currency based on payment type
const getPaymentCurrency = (paymentType: string): 'USD' | 'BRL' => {
  const type = paymentType.toLowerCase();
  if (type.includes('stripe')) return 'USD';
  return 'BRL';
};

// Identifies link/card-like payment types where the proof can be a link/transaction ID
const isLinkPaymentType = (paymentType: string): boolean => {
  const t = paymentType.toLowerCase();
  return t.includes('stripe') || t.includes('link') || t === 'mercadopago';
};

export function ClientPaymentHistory({ clienteId, clienteName, isOpen, onClose, onPaymentUpdate }: ClientPaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEarlyPayment, setShowEarlyPayment] = useState(false);
  const [earlyPaymentAmount, setEarlyPaymentAmount] = useState('');
  const [earlyPaymentProof, setEarlyPaymentProof] = useState<File | null>(null);
  const [earlyPaymentLoading, setEarlyPaymentLoading] = useState(false);
  // Approval-submission dialog state
  const [approvalPayment, setApprovalPayment] = useState<Payment | null>(null);
  const [approvalProof, setApprovalProof] = useState<File | null>(null);
  const [approvalRef, setApprovalRef] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const { fetchClientPayments, cancelPayment, registerEarlyPayment, submitPendingForApproval } = usePaymentStatus();
  const { canRegisterPixpaguePayment } = usePermissions();

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

  const openApprovalDialog = (payment: Payment) => {
    setApprovalPayment(payment);
    setApprovalProof(null);
    setApprovalRef('');
  };

  const handleSubmitForApproval = async () => {
    if (!approvalPayment) return;
    const isLinkLike = isLinkPaymentType(approvalPayment.payment_type);
    if (!approvalProof && !(isLinkLike && approvalRef.trim())) {
      return;
    }
    setApprovalLoading(true);
    const success = await submitPendingForApproval({
      paymentId: approvalPayment.id,
      comprovante: approvalProof,
      transactionRef: approvalProof ? null : approvalRef.trim() || null,
    });
    setApprovalLoading(false);
    if (success) {
      setApprovalPayment(null);
      setApprovalProof(null);
      setApprovalRef('');
      await loadPayments();
      onPaymentUpdate?.();
    }
  };

  const handleCancel = async (paymentId: string) => {
    setActionLoading(paymentId);
    const success = await cancelPayment(paymentId);
    if (success) {
      await loadPayments();
      onPaymentUpdate?.();
    }
    setActionLoading(null);
  };

  const handleEarlyPayment = async () => {
    const amount = parseFloat(earlyPaymentAmount);
    if (!amount || amount <= 0) return;
    setEarlyPaymentLoading(true);
    const success = await registerEarlyPayment(clienteId, amount, earlyPaymentProof || undefined);
    if (success) {
      await loadPayments();
      onPaymentUpdate?.();
      setShowEarlyPayment(false);
      setEarlyPaymentAmount('');
      setEarlyPaymentProof(null);
    }
    setEarlyPaymentLoading(false);
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
    const lowerType = type.toLowerCase();
    if (lowerType.includes('stripe')) {
      return <CreditCard className="w-4 h-4 text-purple-400" />;
    }
    switch (lowerType) {
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
    const lowerType = type.toLowerCase();
    if (lowerType.includes('stripe')) {
      return 'Stripe';
    }
    switch (lowerType) {
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
    const lowerType = type.toLowerCase();
    if (lowerType.includes('stripe')) {
      return 'bg-purple-500/10 border-purple-500/30';
    }
    switch (lowerType) {
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

  const formatCurrency = (value: number, currency: 'BRL' | 'USD' = 'BRL') => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'pt-BR', {
      style: 'currency',
      currency: currency,
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

  // Calculate stats separated by currency
  const paidPayments = payments.filter(p => p.status === 'paid');
  const brlPayments = paidPayments.filter(p => getPaymentCurrency(p.payment_type) === 'BRL');
  const usdPayments = paidPayments.filter(p => getPaymentCurrency(p.payment_type) === 'USD');

  const stats = {
    total: payments.length,
    paid: paidPayments.length,
    pending: payments.filter(p => p.status === 'pending').length,
    totalPaidBRL: brlPayments.reduce((sum, p) => sum + p.amount, 0),
    totalPaidUSD: usdPayments.reduce((sum, p) => sum + p.amount, 0),
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              {/* Show BRL total if there are BRL payments */}
              {stats.totalPaidBRL > 0 && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-xs text-muted-foreground">Total Pago (BRL)</p>
                  <p className="text-sm font-bold text-blue-400">{formatCurrency(stats.totalPaidBRL, 'BRL')}</p>
                </div>
              )}
              {/* Show USD total if there are USD payments */}
              {stats.totalPaidUSD > 0 && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                  <p className="text-xs text-muted-foreground">Total Pago (USD)</p>
                  <p className="text-sm font-bold text-purple-400">{formatCurrency(stats.totalPaidUSD, 'USD')}</p>
                </div>
              )}
              {/* If no payments at all, show empty total */}
              {stats.totalPaidBRL === 0 && stats.totalPaidUSD === 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-xs text-muted-foreground">Total Pago</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(0, 'BRL')}</p>
                </div>
              )}
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
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-purple-400" /> Stripe (USD)
              </span>
            </div>

            {/* Early Payment Button / Form — restricted by permission */}
            {!canRegisterPixpaguePayment() ? null : !showEarlyPayment ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => setShowEarlyPayment(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar pagamento antecipado (PixPague)
              </Button>
            ) : (
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <p className="text-sm font-medium text-emerald-400">Pagamento antecipado (PixPague)</p>
                <p className="text-xs text-muted-foreground">
                  A renovação será calculada a partir da data de vencimento atual.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Valor (R$) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 49.90"
                      value={earlyPaymentAmount}
                      onChange={(e) => setEarlyPaymentAmount(e.target.value)}
                      className={`bg-secondary/50 border-border ${!earlyPaymentAmount && 'border-destructive/50'}`}
                    />
                  </div>
                   <div className="space-y-1">
                    <Label className="text-xs">
                      Comprovante <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setEarlyPaymentProof(e.target.files?.[0] || null)}
                      className="bg-secondary/50 border-border text-xs h-9 pt-1"
                    />
                    {!earlyPaymentProof && (
                      <p className="text-[11px] text-amber-400">
                        Obrigatório — será analisado pela IA antes da aprovação
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-300">
                  ⚠️ O pagamento ficará <strong>pendente de aprovação</strong>. A renovação e o recibo só serão processados após validação no módulo <strong>Segurança de Pagamento</strong>.
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleEarlyPayment}
                    disabled={earlyPaymentLoading || !earlyPaymentAmount || !earlyPaymentProof}
                  >
                    {earlyPaymentLoading ? 'Enviando...' : 'Enviar para aprovação'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { 
                      setShowEarlyPayment(false); 
                      setEarlyPaymentAmount('');
                      setEarlyPaymentProof(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

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
                        {datePayments.map((payment) => {
                          const currency = getPaymentCurrency(payment.payment_type);
                          return (
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
                                        <span className={`font-bold ${currency === 'USD' ? 'text-purple-400' : 'text-primary'}`}>
                                          {formatCurrency(payment.amount, currency)}
                                        </span>
                                      </div>
                                      {payment.receipt_number && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Receipt className="w-3 h-3" />
                                          {payment.receipt_number}
                                        </p>
                                      )}
                                      {payment.comprovante_url && (
                                        <a 
                                          href={payment.comprovante_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                                        >
                                          <FileText className="w-3 h-3" />
                                          Ver Comprovante
                                        </a>
                                      )}
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
                                        onClick={() => openApprovalDialog(payment)}
                                        disabled={actionLoading === payment.id}
                                        title="Marcar como pago (envia para Segurança de Pagamento)"
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
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>

      {/* Dialog: enviar pagamento pendente para Segurança de Pagamento */}
      <Dialog open={!!approvalPayment} onOpenChange={(open) => { if (!open) setApprovalPayment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar para aprovação</DialogTitle>
            <DialogDescription>
              {approvalPayment && (
                <>
                  {getPaymentTypeLabel(approvalPayment.payment_type)} •{' '}
                  {formatCurrency(approvalPayment.amount, getPaymentCurrency(approvalPayment.payment_type))}
                  <br />
                  Anexe o comprovante {isLinkPaymentType(approvalPayment.payment_type) ? 'ou cole o link/ID da transação' : 'do pagamento'} para enviar para "Segurança de Pagamento".
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Comprovante (imagem ou PDF)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setApprovalProof(e.target.files?.[0] || null)}
                className="bg-secondary border-border h-10 text-xs"
              />
            </div>

            {approvalPayment && isLinkPaymentType(approvalPayment.payment_type) && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Ou cole o link / ID da transação (Mercado Pago / Stripe)
                </Label>
                <Input
                  type="text"
                  placeholder="https://... ou pi_... / ID numérico"
                  value={approvalRef}
                  onChange={(e) => setApprovalRef(e.target.value)}
                  className="bg-secondary border-border h-10 text-xs"
                  disabled={!!approvalProof}
                />
              </div>
            )}

            <p className="text-[11px] text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded p-2">
              ⚠️ A cobrança ficará <b>aguardando aprovação</b> em "Segurança de Pagamento". O recibo e a renovação só serão liberados após aprovação.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setApprovalPayment(null)} disabled={approvalLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitForApproval}
              disabled={
                approvalLoading ||
                (!approvalProof &&
                  !(approvalPayment && isLinkPaymentType(approvalPayment.payment_type) && approvalRef.trim()))
              }
            >
              {approvalLoading ? 'Enviando...' : 'Enviar para aprovação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
