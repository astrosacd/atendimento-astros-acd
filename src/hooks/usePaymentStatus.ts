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
        .select('status, amount, payment_type');
      
      if (error) throw error;
      
      const stats = {
        total: data?.length || 0,
        paid: 0,
        pending: 0,
        rejected: 0,
        totalPaidBrl: 0,
        totalPaidUsd: 0,
        totalPendingBrl: 0,
        totalPendingUsd: 0,
      };
      
      // Stripe types are paid in USD, everything else is BRL
      const isStripePayment = (type: string) => 
        type?.toLowerCase().includes('stripe');
      
      data?.forEach(payment => {
        const isUsd = isStripePayment(payment.payment_type);
        
        if (payment.status === 'paid') {
          stats.paid++;
          if (isUsd) {
            stats.totalPaidUsd += Number(payment.amount);
          } else {
            stats.totalPaidBrl += Number(payment.amount);
          }
        } else if (payment.status === 'pending') {
          stats.pending++;
          if (isUsd) {
            stats.totalPendingUsd += Number(payment.amount);
          } else {
            stats.totalPendingBrl += Number(payment.amount);
          }
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
          .select('data_renovacao, ciclo_cobranca')
          .eq('id', payment.cliente_id)
          .single();
        
        if (!clienteError && cliente) {
          // Use the later of today or the current renewal date as base,
          // then add the billing cycle period (default 1 month).
          // This prevents inactive clients from getting a renewal date still in the past.
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const renewalDate = new Date(cliente.data_renovacao);
          const baseDate = renewalDate > today ? renewalDate : today;
          
          // Respect billing cycle
          const cycleMonths: Record<string, number> = {
            mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
          };
          const months = cycleMonths[cliente.ciclo_cobranca] || 1;
          baseDate.setMonth(baseDate.getMonth() + months);
          const newRenewalDate = baseDate.toISOString().split('T')[0];
          
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

  // Register early payment (before billing date)
  // ⚠️ NEW FLOW: Always requires proof + admin approval. Does NOT auto-renew or auto-send receipt.
  // Renewal + receipt happen later via "approve-pixpague-payment" edge function (Segurança de Pagamento module).
  const registerEarlyPayment = async (clienteId: string, amount: number, comprovante?: File): Promise<boolean> => {
    try {
      // Enforce proof requirement
      if (!comprovante) {
        toast({
          title: 'Comprovante obrigatório',
          description: 'É necessário anexar o comprovante PIX para enviar o pagamento para aprovação.',
          variant: 'destructive',
        });
        return false;
      }

      const paymentId = `manual_early_${Date.now()}`;
      let comprovanteUrl: string | null = null;

      // Capture the system user who is submitting this payment (for Segurança de Pagamento traceability)
      const { data: { user: submitter } } = await supabase.auth.getUser();
      let submittedByName: string | null = null;
      if (submitter?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', submitter.id)
          .maybeSingle();
        submittedByName = profile?.name ?? null;
      }

      // Upload proof
      const fileExt = comprovante.name.split('.').pop();
      const fileName = `${clienteId}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, comprovante);

      if (uploadError || !uploadData) {
        console.error('Error uploading proof:', uploadError);
        toast({
          title: 'Erro ao enviar comprovante',
          description: uploadError?.message || 'Falha no upload do arquivo.',
          variant: 'destructive',
        });
        return false;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(uploadData.path);
      comprovanteUrl = publicUrl;

      // Insert payment record as PENDING APPROVAL (not paid yet)
      const { data: insertedPayment, error: insertError } = await supabase
        .from('client_payments')
        .insert({
          cliente_id: clienteId,
          payment_id: paymentId,
          payment_type: 'pix_manual',
          amount,
          status: 'pending_approval',
          paid_at: null,
          billing_date: new Date().toISOString().split('T')[0],
          comprovante_url: comprovanteUrl,
          ocr_status: 'pending',
          submitted_by: submitter?.id ?? null,
          submitted_by_email: submitter?.email ?? null,
          submitted_by_name: submittedByName,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Dispara processamento PixPague em BACKGROUND (servidor segura a tarefa
      // mesmo se o cliente fechar a página). Aguardamos só o "ack" do trigger.
      if (insertedPayment?.id) {
        try {
          await supabase.functions.invoke('pixpague-trigger-processing', {
            body: {
              paymentId: insertedPayment.id,
              proofUrl: comprovanteUrl,
              declaredAmount: amount,
            },
          });
        } catch (err) {
          console.error('Erro ao agendar processamento PixPague:', err);
        }
      }

      toast({
        title: '📨 Enviado para aprovação',
        description: 'O pagamento ficará pendente até ser aprovado em "Segurança de Pagamento". A renovação e o recibo serão processados após aprovação.',
      });

      return true;
    } catch (error) {
      console.error('Error registering early payment:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao registrar pagamento antecipado',
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
    registerEarlyPayment,
  };
}
