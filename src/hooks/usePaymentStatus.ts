import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentStatusResult {
  checked: number;
  updated: number;
  errors: number;
  details: Array<{
    payment_id: string;
    old_status: string;
    new_status: string;
    cliente_id: string;
  }>;
}

interface ClientPayment {
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
}

export function usePaymentStatus() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const checkPaymentStatus = async (): Promise<PaymentStatusResult | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-payment-status');
      
      if (error) throw error;
      
      if (data.updated > 0) {
        toast({
          title: 'Pagamentos atualizados',
          description: `${data.updated} pagamento(s) foram atualizados`,
        });
      } else {
        toast({
          title: 'Verificação concluída',
          description: `${data.checked} pagamentos verificados, nenhuma alteração`,
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error checking payment status:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao verificar status dos pagamentos',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientPayments = async (clienteId?: string): Promise<ClientPayment[]> => {
    try {
      let query = supabase
        .from('client_payments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  };

  const getPaymentStats = async () => {
    try {
      const { data, error } = await supabase
        .from('client_payments')
        .select('status, amount');
      
      if (error) throw error;
      
      const stats = {
        total: data?.length || 0,
        paid: 0,
        pending: 0,
        rejected: 0,
        totalPaid: 0,
        totalPending: 0,
      };
      
      data?.forEach(payment => {
        if (payment.status === 'paid') {
          stats.paid++;
          stats.totalPaid += Number(payment.amount);
        } else if (payment.status === 'pending') {
          stats.pending++;
          stats.totalPending += Number(payment.amount);
        } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
          stats.rejected++;
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      return null;
    }
  };

  // Mark payment as paid manually (for payments outside Mercado Pago)
  // Also updates the client's renewal date to next month and sends receipt
  const markPaymentAsPaid = async (paymentId: string): Promise<boolean> => {
    try {
      // First get the payment to find the cliente_id
      const { data: payment, error: fetchError } = await supabase
        .from('client_payments')
        .select('cliente_id')
        .eq('id', paymentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const paidAt = new Date().toISOString();
      
      // Update payment status
      const { error } = await supabase
        .from('client_payments')
        .update({ 
          status: 'paid', 
          paid_at: paidAt,
        })
        .eq('id', paymentId);
      
      if (error) throw error;
      
      // If we have a cliente_id, update the renewal date and send receipt
      if (payment?.cliente_id) {
        // Get current client renewal date
        const { data: cliente, error: clienteError } = await supabase
          .from('clientes')
          .select('data_renovacao')
          .eq('id', payment.cliente_id)
          .single();
        
        if (!clienteError && cliente) {
          // Add 1 month to renewal date
          const currentDate = new Date(cliente.data_renovacao);
          currentDate.setMonth(currentDate.getMonth() + 1);
          const newRenewalDate = currentDate.toISOString().split('T')[0];
          
          // Update client - the database trigger will recalculate D-3, D+1, D+2, D+15, D+30
          await supabase
            .from('clientes')
            .update({ data_renovacao: newRenewalDate })
            .eq('id', payment.cliente_id);
        }
        
        // Send receipt via edge function
        try {
          console.log('Enviando recibo para cliente:', payment.cliente_id);
          const { data: receiptResult, error: receiptError } = await supabase.functions.invoke('send-receipt', {
            body: {
              clienteId: payment.cliente_id,
              paymentId: paymentId,
              paidAt: paidAt,
            },
          });
          
          if (receiptError) {
            console.error('Erro ao enviar recibo:', receiptError);
          } else {
            console.log('Resultado do recibo:', receiptResult);
          }
        } catch (receiptErr) {
          console.error('Erro ao chamar função de recibo:', receiptErr);
        }
      }
      
      toast({
        title: 'Pagamento confirmado',
        description: 'Status atualizado, data de renovação avançada e recibo enviado',
      });
      
      return true;
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao marcar pagamento como pago',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Mark payment as cancelled
  const cancelPayment = async (paymentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('client_payments')
        .update({ status: 'cancelled' })
        .eq('id', paymentId);
      
      if (error) throw error;
      
      toast({
        title: 'Pagamento cancelado',
        description: 'Status atualizado para cancelado',
      });
      
      return true;
    } catch (error) {
      console.error('Error cancelling payment:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao cancelar pagamento',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    isLoading,
    checkPaymentStatus,
    fetchClientPayments,
    getPaymentStats,
    markPaymentAsPaid,
    cancelPayment,
  };
}
