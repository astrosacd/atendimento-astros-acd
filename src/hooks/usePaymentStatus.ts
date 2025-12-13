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

  return {
    isLoading,
    checkPaymentStatus,
    fetchClientPayments,
    getPaymentStats,
  };
}
