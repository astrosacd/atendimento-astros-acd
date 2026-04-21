import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGatewayOrders, GatewayOrder } from '@/hooks/useGateway';
import { Eye, RefreshCw, Mail, CheckCircle, XCircle, FileText, AlertTriangle, Search, ExternalLink } from 'lucide-react';
import { useGatewaySettings } from '@/hooks/useGateway';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function GatewayOrders() {
  const { orders, isLoading, updateOrder, refetch, isRefetching } = useGatewayOrders();
  const { settings } = useGatewaySettings();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<GatewayOrder | null>(null);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);

  const approvalConfig = settings.approval_config || { workflow: 'admin_only', ocr_enabled: true };

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const formatCurrency = (value: number, currency: 'BRL' | 'USD' = 'BRL') => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'outline', label: 'Pendente' },
      paid: { variant: 'default', label: 'Pago' },
      cancelled: { variant: 'destructive', label: 'Cancelado' },
      rejected: { variant: 'destructive', label: 'Rejeitado' },
      abandoned: { variant: 'secondary', label: 'Abandonado' },
    };
    const config = variants[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrder({ id: orderId, status: newStatus as any });
  };

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success('Pedidos atualizados!');
    } catch (error) {
      toast.error('Erro ao atualizar pedidos');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Pedidos ({filteredOrders.length})</h2>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
              <SelectItem value="abandoned">Abandonados</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm">{formatDate(order.created_at)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{order.product?.name || '-'}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(order.total, order.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {order.payment_gateway === 'stripe' ? 'Stripe' : 
                           order.payment_gateway === 'mercadopago' ? 'Mercado Pago' : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(order.status)}
                          {order.abandoned_email_sent && order.status === 'pending' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="gap-1 text-xs bg-amber-500/20 text-amber-600 border-amber-500/30">
                                    <Mail className="h-3 w-3" />
                                    Enviado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Email de recuperação de carrinho abandonado já foi enviado</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID do Pedido</p>
                  <p className="font-mono text-sm">{selectedOrder.id.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p>{formatDate(selectedOrder.created_at)}</p>
                </div>
              </div>

              {selectedOrder.proof_url && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Comprovante</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs gap-1"
                      onClick={() => window.open(selectedOrder.proof_url!, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" /> Ver Original
                    </Button>
                  </div>
                  <div className="relative aspect-video rounded-md border overflow-hidden bg-muted group">
                    <img 
                      src={selectedOrder.proof_url} 
                      alt="Comprovante" 
                      className="object-contain w-full h-full"
                    />
                  </div>
                  
                  {selectedOrder.ocr_status && (
                    <div className={`mt-2 p-2 rounded-md border text-xs flex items-center gap-2 ${
                      selectedOrder.ocr_status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-700' :
                      selectedOrder.ocr_status === 'mismatch' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700' :
                      'bg-muted border-border text-muted-foreground'
                    }`}>
                      {selectedOrder.ocr_status === 'success' ? <CheckCircle className="h-3 w-3" /> : 
                       selectedOrder.ocr_status === 'mismatch' ? <AlertTriangle className="h-3 w-3" /> :
                       <Search className="h-3 w-3" />}
                      <div>
                        <span className="font-semibold uppercase">{selectedOrder.ocr_status === 'success' ? 'Validado por IA' : 
                                                                  selectedOrder.ocr_status === 'mismatch' ? 'Atenção: Divergência' : 'OCR Pendente'}</span>
                        {selectedOrder.ocr_amount && (
                          <p>Valor extraído: {formatCurrency(selectedOrder.ocr_amount, selectedOrder.currency)}</p>
                        )}
                        {selectedOrder.pix_transaction_id && (
                          <p className="truncate">ID Transação: {selectedOrder.pix_transaction_id}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!selectedOrder.ocr_status && approvalConfig.ocr_enabled && (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="w-full mt-2 h-8 text-xs gap-2"
                      onClick={async () => {
                        setIsProcessingOCR(true);
                        toast.info("Processando OCR com IA...");
                        try {
                          const { data, error } = await supabase.functions.invoke('gateway-ocr-pix', {
                            body: { orderId: selectedOrder.id }
                          });
                          if (error) throw error;
                          toast.success("OCR processado!");
                          refetch();
                        } catch (err) {
                          console.error(err);
                          toast.error("Erro no OCR");
                        } finally {
                          setIsProcessingOCR(false);
                        }
                      }}
                      disabled={isProcessingOCR}
                    >
                      <Search className={`h-3 w-3 ${isProcessingOCR ? 'animate-spin' : ''}`} />
                      Processar com IA agora
                    </Button>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Cliente</p>
                <div className="space-y-1">
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                  <p className="text-sm">{selectedOrder.customer_email}</p>
                  {selectedOrder.customer_phone && (
                    <p className="text-sm">{selectedOrder.customer_phone}</p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Produto</p>
                <p className="font-medium">{selectedOrder.product?.name || 'Produto removido'}</p>
                {selectedOrder.order_bump && (
                  <p className="text-sm text-muted-foreground">
                    + Order Bump: {selectedOrder.order_bump.name}
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Valores</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal, selectedOrder.currency)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto {selectedOrder.coupon?.code && `(${selectedOrder.coupon.code})`}</span>
                      <span>-{formatCurrency(selectedOrder.discount_amount, selectedOrder.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total, selectedOrder.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Ações de Aprovação</p>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700" 
                    onClick={() => handleStatusChange(selectedOrder.id, 'paid')}
                    disabled={selectedOrder.status === 'paid'}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aprovar Pagamento
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => {
                      const reason = prompt("Motivo da rejeição:");
                      if (reason) {
                        updateOrder({ id: selectedOrder.id, status: 'rejected', rejection_reason: reason });
                        setSelectedOrder({ ...selectedOrder, status: 'rejected', rejection_reason: reason });
                      }
                    }}
                    disabled={selectedOrder.status === 'paid' || selectedOrder.status === 'rejected'}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeitar
                  </Button>
                </div>
                
                {selectedOrder.rejection_reason && (
                  <p className="mt-2 text-xs text-destructive italic">
                    Motivo da rejeição: {selectedOrder.rejection_reason}
                  </p>
                )}
                
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Alterar Status Manualmente</p>
                  <Select 
                    value={selectedOrder.status} 
                    onValueChange={(value) => {
                      handleStatusChange(selectedOrder.id, value);
                      setSelectedOrder({ ...selectedOrder, status: value as any });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="rejected">Rejeitado</SelectItem>
                      <SelectItem value="abandoned">Abandonado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(selectedOrder.payment_id || selectedOrder.pix_transaction_id) && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Pagamento</p>
                  {selectedOrder.payment_id && <p className="font-mono text-sm">ID Gateway: {selectedOrder.payment_id}</p>}
                  {selectedOrder.pix_transaction_id && <p className="font-mono text-sm">ID PIX: {selectedOrder.pix_transaction_id}</p>}
                  <p className="text-sm">Gateway: {selectedOrder.payment_gateway || 'Pix'}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
