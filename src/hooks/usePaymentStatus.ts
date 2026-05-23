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
      // First get the payment to find the cliente_id + billing_date + type
      const { data: payment, error: fetchError } = await supabase
        .from('client_payments')
        .select('cliente_id, billing_date, payment_type')
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
          // Regra: sempre avança 1 ciclo a partir da data_renovacao existente
          // (independente de estar atrasada, no dia ou antecipada).
          const cycleMonths: Record<string, number> = {
            mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
          };
          const months = cycleMonths[cliente.ciclo_cobranca] || 1;
          const baseDate = new Date(cliente.data_renovacao);
          baseDate.setMonth(baseDate.getMonth() + months);
          const newRenewalDate = baseDate.toISOString().split('T')[0];
          
          // Update client - the database trigger will recalculate D-3, D+1, D+2, D+15, D+30
          await supabase
            .from('clientes')
            .update({ data_renovacao: newRenewalDate })
            .eq('id', payment.cliente_id);
        }

        // SACADA 2: Auto-cancelar TODAS as outras cobranças pendentes deste cliente
        // (D-3, D+1, D+2, D+15, D+30 etc). Uma vez paga uma forma, as demais do mesmo
        // ciclo ficam sem efeito. Como data_renovacao já avançou 1 ciclo acima, o cron
        // só vai gerar novas cobranças quando chegar a D-3 do novo vencimento.
        try {
          const { data: cancelled, error: cancelErr } = await supabase
            .from('client_payments')
            .update({
              status: 'cancelled',
              approval_reason: `Cancelado automaticamente — pago via ${payment.payment_type}`,
            })
            .eq('cliente_id', payment.cliente_id)
            .in('status', ['pending', 'pending_approval'])
            .neq('id', paymentId)
            .select('id');

          if (cancelErr) {
            console.error('Erro ao auto-cancelar outras cobranças:', cancelErr);
          } else if (cancelled && cancelled.length > 0) {
            console.log(`Auto-canceladas ${cancelled.length} cobranças pendentes do cliente`);
          }
        } catch (e) {
          console.error('Exceção no auto-cancelamento:', e);
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

  // Register a payment paid via external Payment Link (Mercado Pago / Stripe).
  // Validates the link/payment ID against the gateway and stores it as pending_approval
  // so it shows up in "Segurança de Pagamento" with the validated data (amount, txn id, status).
  const registerLinkPayment = async (params: {
    clienteId: string;
    declaredAmount: number;
    paymentLinkUrl?: string;       // raw URL pasted by the user
    paymentLinkId?: string;        // optional: id from payment_links dropdown
    provider?: 'mercadopago' | 'stripe';
    mpPaymentId?: string;          // when already known (from dropdown)
    stripePaymentId?: string;      // when already known (from dropdown)
  }): Promise<{ ok: boolean; ocrStatus?: string; gatewayAmount?: number; transactionId?: string; }> => {
    try {
      const {
        clienteId, declaredAmount, paymentLinkUrl, paymentLinkId,
        provider, mpPaymentId: providedMp, stripePaymentId: providedStripe,
      } = params;

      // 1) Resolve which gateway/IDs to query
      let mpPaymentId: string | undefined = providedMp;
      let stripePaymentId: string | undefined = providedStripe;
      let resolvedProvider: 'mercadopago' | 'stripe' | undefined = provider;
      let linkUrlToStore: string | null = paymentLinkUrl?.trim() || null;

      // If a saved link from the dropdown was chosen, look it up
      if (paymentLinkId && !mpPaymentId && !stripePaymentId) {
        const { data: linkRow } = await supabase
          .from('payment_links')
          .select('provider, preference_id, external_reference, mp_payment_id, payment_url, status')
          .eq('id', paymentLinkId)
          .maybeSingle();

        if (linkRow) {
          linkUrlToStore = linkRow.payment_url || linkUrlToStore;
          resolvedProvider = (linkRow.provider as any) || resolvedProvider;
          if (linkRow.mp_payment_id) {
            if (resolvedProvider === 'stripe') stripePaymentId = linkRow.mp_payment_id;
            else mpPaymentId = linkRow.mp_payment_id;
          }
        }
      }

      // If only the URL was given, try to extract IDs from it
      if (!mpPaymentId && !stripePaymentId && linkUrlToStore) {
        const url = linkUrlToStore;
        // Stripe formats: pi_xxx, cs_xxx, plink_xxx (payment link id)
        const stripeMatch = url.match(/\b(pi|cs|cs_test|cs_live|plink)_[A-Za-z0-9]+/);
        // Mercado Pago: payment_id in querystring or numeric id
        const mpQs = url.match(/[?&](?:payment_id|collection_id)=(\d+)/);
        if (stripeMatch) {
          stripePaymentId = stripeMatch[0];
          resolvedProvider = 'stripe';
        } else if (mpQs) {
          mpPaymentId = mpQs[1];
          resolvedProvider = 'mercadopago';
        }
      }

      // 2) Call gateway validator
      let ocrStatus: string = 'pending';
      let gatewayAmount: number | null = null;
      let transactionId: string | null = mpPaymentId || stripePaymentId || null;
      let gatewayStatus: string | null = null;

      if (mpPaymentId || stripePaymentId) {
        const { data: result, error: invokeErr } = await supabase.functions.invoke('check-payment-link-status', {
          body: mpPaymentId ? { mp_payment_id: mpPaymentId } : { stripe_payment_id: stripePaymentId },
        });
        if (invokeErr) {
          console.error('Erro ao validar link de pagamento:', invokeErr);
        }
        if (result && !result.error) {
          gatewayAmount = typeof result.amount === 'number' ? result.amount : null;
          transactionId = result.payment_id || transactionId;
          gatewayStatus = result.status || null;

          // If gateway returns approved/paid → check value match
          const isApproved = gatewayStatus === 'approved' || gatewayStatus === 'paid' || gatewayStatus === 'succeeded';
          if (isApproved) {
            if (gatewayAmount !== null && Math.abs(gatewayAmount - declaredAmount) > 0.01) {
              ocrStatus = 'divergent';
            } else {
              ocrStatus = 'success';
            }
          } else {
            // Not paid yet → keep pending so admin can re-check later
            ocrStatus = 'pending';
          }
        } else {
          // Gateway returned not_found / error
          ocrStatus = 'invalid';
        }
      } else {
        // No ID extractable → admin must approve manually
        ocrStatus = 'pending';
      }

      // 3) Duplicate detection — same transaction id already used in another payment
      if (transactionId) {
        const { data: dup } = await supabase
          .from('client_payments')
          .select('id')
          .eq('pix_transaction_id', transactionId)
          .limit(1)
          .maybeSingle();
        if (dup) ocrStatus = 'duplicate';
      }

      // 4) Capture submitter
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

      // 5) Insert as pending_approval so it appears in Segurança de Pagamento
      const paymentId = `manual_link_${Date.now()}`;
      const { data: insertedPayment, error: insertError } = await supabase
        .from('client_payments')
        .insert({
          cliente_id: clienteId,
          payment_id: paymentId,
          payment_type: 'link_pagamento',
          amount: declaredAmount,
          status: 'pending_approval',
          paid_at: null,
          billing_date: new Date().toISOString().split('T')[0],
          comprovante_url: linkUrlToStore,
          pix_transaction_id: transactionId,
          ocr_status: ocrStatus,
          ocr_amount: gatewayAmount,
          submitted_by: submitter?.id ?? null,
          submitted_by_email: submitter?.email ?? null,
          submitted_by_name: submittedByName,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Fire WhatsApp notification to approvers (manual review path for link)
      if (insertedPayment?.id) {
        try {
          await supabase.functions.invoke('pixpague-trigger-processing', {
            body: {
              paymentId: insertedPayment.id,
              proofUrl: linkUrlToStore || 'link-review',
              declaredAmount,
              manualReview: true,
            },
          });
        } catch (notifyErr) {
          console.error('[registerLinkPayment] notify error:', notifyErr);
        }
      }

      toast({
        title: '📨 Enviado para aprovação',
        description: 'O link de pagamento foi validado e enviado para "Segurança de Pagamento".',
      });

      return {
        ok: true,
        ocrStatus,
        gatewayAmount: gatewayAmount ?? undefined,
        transactionId: transactionId ?? undefined,
      };
    } catch (error) {
      console.error('Error registering link payment:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao registrar pagamento por link',
        variant: 'destructive',
      });
      return { ok: false };
    }
  };

  // Register a manual / "Other" payment (boleto, transferência, dinheiro, etc.)
  // Always goes to "Segurança de Pagamento" as pending_approval.
  // Observation is REQUIRED; proof file is OPTIONAL but recommended.
  const registerOtherPayment = async (params: {
    clienteId: string;
    declaredAmount: number;
    observation: string;
    proof?: File | null;
  }): Promise<boolean> => {
    try {
      const { clienteId, declaredAmount, observation, proof } = params;

      if (!observation || !observation.trim()) {
        toast({
          title: 'Observação obrigatória',
          description: 'Explique o motivo do pagamento manual / outros.',
          variant: 'destructive',
        });
        return false;
      }

      // Optional proof upload
      let proofUrl: string | null = null;
      if (proof) {
        const fileExt = proof.name.split('.').pop();
        const fileName = `${clienteId}_other_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, proof);
        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(uploadData.path);
          proofUrl = publicUrl;
        }
      }

      // Capture submitter
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

      const paymentId = `manual_other_${Date.now()}`;
      const { data: inserted, error: insertError } = await supabase
        .from('client_payments')
        .insert({
          cliente_id: clienteId,
          payment_id: paymentId,
          payment_type: 'outros_manual',
          amount: declaredAmount,
          status: 'pending_approval',
          paid_at: null,
          billing_date: new Date().toISOString().split('T')[0],
          comprovante_url: proofUrl,
          ocr_status: 'manual_review',
          approval_reason: observation.trim(),
          submitted_by: submitter?.id ?? null,
          submitted_by_email: submitter?.email ?? null,
          submitted_by_name: submittedByName,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Fire WhatsApp notification to approvers (manual review path)
      try {
        await supabase.functions.invoke('pixpague-trigger-processing', {
          body: {
            paymentId: inserted?.id,
            proofUrl: proofUrl || 'manual-review',
            declaredAmount,
            manualReview: true,
          },
        });
      } catch (notifyErr) {
        console.error('[registerOtherPayment] notify error:', notifyErr);
      }

      toast({
        title: '📨 Enviado para aprovação',
        description: 'O pagamento manual foi enviado para "Segurança de Pagamento" para aprovação.',
      });

      return true;
    } catch (error) {
      console.error('Error registering other payment:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao registrar pagamento manual.',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Submit a pending billing for approval (sends to "Segurança de Pagamento")
  // Used when the user clicks the green "Pago" button on a billing — instead of
  // marking it as paid directly, the billing is updated to pending_approval with
  // the proof attached (PIX/Boleto = file required; Link/Stripe = link or proof).
  const submitPendingForApproval = async (params: {
    paymentId: string;
    comprovante?: File | null;
    transactionRef?: string | null; // payment link URL or transaction ID
  }): Promise<boolean> => {
    try {
      const { paymentId, comprovante, transactionRef } = params;

      // Capture submitter for traceability
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

      // Get current payment to find cliente_id
      const { data: existing, error: fetchError } = await supabase
        .from('client_payments')
        .select('cliente_id, amount')
        .eq('id', paymentId)
        .single();
      if (fetchError) throw fetchError;

      // Upload proof if provided
      let comprovanteUrl: string | null = null;
      if (comprovante) {
        const fileExt = comprovante.name.split('.').pop();
        const fileName = `${existing.cliente_id}_${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, comprovante);
        if (uploadError || !uploadData) {
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
      } else if (transactionRef) {
        // Use the link/transaction reference as the "proof" pointer
        comprovanteUrl = transactionRef;
      } else {
        toast({
          title: 'Comprovante obrigatório',
          description: 'Anexe o comprovante ou informe o link/ID da transação para enviar para aprovação.',
          variant: 'destructive',
        });
        return false;
      }

      // Update billing → pending_approval (do NOT mark as paid yet)
      const { error: updateError } = await supabase
        .from('client_payments')
        .update({
          status: 'pending_approval',
          comprovante_url: comprovanteUrl,
          ocr_status: 'pending',
          submitted_by: submitter?.id ?? null,
          submitted_by_email: submitter?.email ?? null,
          submitted_by_name: submittedByName,
        })
        .eq('id', paymentId);
      if (updateError) throw updateError;

      // Trigger background analysis (OCR / link validation) or simple notification
      if (comprovanteUrl) {
        try {
          await supabase.functions.invoke('pixpague-trigger-processing', {
            body: {
              paymentId,
              proofUrl: comprovanteUrl,
              declaredAmount: existing.amount,
              // If it's just a text reference (link/ID) and not a file upload, 
              // we treat it as manual review to skip OCR and send the notification.
              manualReview: !comprovante,
            },
          });
        } catch (err) {
          console.error('Erro ao agendar análise:', err);
        }
      }

      toast({
        title: '📨 Enviado para aprovação',
        description: 'A cobrança foi para "Segurança de Pagamento". O recibo e a renovação só serão liberados após aprovação.',
      });

      return true;
    } catch (error) {
      console.error('Error submitting payment for approval:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao enviar pagamento para aprovação.',
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
    registerLinkPayment,
    registerOtherPayment,
    submitPendingForApproval,
  };
}
