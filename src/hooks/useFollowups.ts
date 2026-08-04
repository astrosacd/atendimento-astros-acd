import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSystemActivities } from '@/hooks/useSystemActivities';

export type EnvioTipo = 'proposta' | 'contrato' | 'distrato';

export const ENVIO_TIPO_LABEL: Record<EnvioTipo, string> = {
  proposta: 'Proposta',
  contrato: 'Contrato',
  distrato: 'Distrato',
};

export interface Followup {
  id: string;
  cliente_id: string | null;
  manual_name: string | null;
  manual_email: string | null;
  manual_phone: string | null;
  produto: string;
  message_template: string | null;
  custom_message: string | null;
  channel: 'whatsapp' | 'email' | 'both';
  scheduled_at: string;
  is_recurring: boolean;
  recurrence_interval_days: number | null;
  max_attempts: number;
  current_attempt: number;
  next_dispatch_at: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string; email: string; numero: string } | null;
  conversion_status: 'converted' | 'not_converted' | null;
  conversion_note: string | null;
  converted_at: string | null;
  envio_tipo: EnvioTipo;
  doc_link: string | null;
  doc_pdf_url: string | null;
  doc_pdf_name: string | null;
}

export interface FollowupLog {
  id: string;
  followup_id: string;
  channel: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}

export interface CreateFollowupData {
  cliente_id?: string | null;
  manual_name?: string;
  manual_email?: string;
  manual_phone?: string;
  produto: string;
  custom_message?: string;
  channel: 'whatsapp' | 'email' | 'both';
  scheduled_at: string;
  is_recurring: boolean;
  recurrence_interval_days?: number;
  max_attempts?: number;
  envio_tipo?: EnvioTipo;
  doc_link?: string | null;
  doc_pdf_url?: string | null;
  doc_pdf_name?: string | null;
}


export function useFollowups() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logActivity } = useSystemActivities();

  const { data: followups = [], isLoading } = useQuery({
    queryKey: ['followups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_followups')
        .select('*, clientes(nome, email, numero)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Followup[];
    },
  });

  const createFollowup = useMutation({
    mutationFn: async (input: CreateFollowupData) => {
      const { data, error } = await supabase
        .from('client_followups')
        .insert({
          cliente_id: input.cliente_id || null,
          manual_name: input.manual_name || null,
          manual_email: input.manual_email || null,
          manual_phone: input.manual_phone || null,
          produto: input.produto,
          custom_message: input.custom_message || null,
          channel: input.channel,
          scheduled_at: input.scheduled_at,
          is_recurring: input.is_recurring,
          recurrence_interval_days: input.is_recurring ? (input.recurrence_interval_days || 3) : null,
          max_attempts: input.is_recurring ? (input.max_attempts || 3) : 1,
          next_dispatch_at: input.scheduled_at,
          status: 'pending',
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up agendado com sucesso!');
      logActivity(`Agendou follow-up: ${input.manual_name || 'Cliente'}`, 'followup', `Produto: ${input.produto}`);
    },
    onError: (err: any) => {
      toast.error('Erro ao criar follow-up: ' + err.message);
    },
  });

  const cancelFollowup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_followups')
        .update({ status: 'cancelled' } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up cancelado');
      logActivity(`Cancelou um follow-up`, 'followup');
    },
    onError: (err: any) => {
      toast.error('Erro ao cancelar: ' + err.message);
    },
  });

  const updateFollowup = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreateFollowupData> & { id: string }) => {
      const updateData: any = {};
      if (updates.produto !== undefined) updateData.produto = updates.produto;
      if (updates.custom_message !== undefined) updateData.custom_message = updates.custom_message || null;
      if (updates.channel !== undefined) updateData.channel = updates.channel;
      if (updates.scheduled_at !== undefined) {
        updateData.scheduled_at = updates.scheduled_at;
        updateData.next_dispatch_at = updates.scheduled_at;
      }
      if (updates.is_recurring !== undefined) {
        updateData.is_recurring = updates.is_recurring;
        updateData.recurrence_interval_days = updates.is_recurring ? (updates.recurrence_interval_days || 3) : null;
        updateData.max_attempts = updates.is_recurring ? (updates.max_attempts || 3) : 1;
      }
      if (updates.manual_name !== undefined) updateData.manual_name = updates.manual_name || null;
      if (updates.manual_email !== undefined) updateData.manual_email = updates.manual_email || null;
      if (updates.manual_phone !== undefined) updateData.manual_phone = updates.manual_phone || null;
      if (updates.cliente_id !== undefined) updateData.cliente_id = updates.cliente_id || null;

      const { error } = await supabase
        .from('client_followups')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up atualizado!');
      logActivity(`Atualizou follow-up de ${variables.manual_name || 'Cliente'}`, 'followup');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar: ' + err.message);
    },
  });

  const cloneFollowup = useMutation({
    mutationFn: async (followup: Followup) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const { data, error } = await supabase
        .from('client_followups')
        .insert({
          cliente_id: followup.cliente_id,
          manual_name: followup.manual_name,
          manual_email: followup.manual_email,
          manual_phone: followup.manual_phone,
          produto: followup.produto,
          custom_message: followup.custom_message,
          channel: followup.channel,
          scheduled_at: tomorrow.toISOString(),
          is_recurring: followup.is_recurring,
          recurrence_interval_days: followup.recurrence_interval_days,
          max_attempts: followup.max_attempts,
          current_attempt: 0,
          next_dispatch_at: tomorrow.toISOString(),
          status: 'pending',
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up clonado! Edite a data e mensagem conforme necessário.');
      logActivity(`Clonou follow-up: ${data.manual_name || 'Cliente'}`, 'followup');
    },
    onError: (err: any) => {
      toast.error('Erro ao clonar: ' + err.message);
    },
  });

  const deleteFollowup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_followups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up excluído');
      logActivity(`Excluiu um follow-up`, 'followup');
    },
    onError: (err: any) => {
      toast.error('Erro ao excluir: ' + err.message);
    },
  });

  const retryFollowup = useMutation({
    mutationFn: async (id: string) => {
      // First, reset status to pending so the edge function picks it up
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('client_followups')
        .update({
          status: 'pending',
          next_dispatch_at: now,
        } as any)
        .eq('id', id);
      if (error) throw error;

      // Immediately invoke the process-followups edge function
      const { data, error: fnError } = await supabase.functions.invoke('process-followups', {
        body: { followup_id: id },
      });
      if (fnError) throw fnError;

      const deliverySucceeded = Boolean(data?.email_sent || data?.whatsapp_sent);
      if (!deliverySucceeded) {
        const failureMessage = data?.error || data?.message || 'Nenhum canal confirmou o envio. Verifique a conexão do WhatsApp/e-mail.';
        throw new Error(failureMessage);
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up reenviado!');
      logActivity(`Reenviou follow-up ${id}`, 'followup');
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.error('Erro ao reenviar: ' + err.message);
    },
  });

  const markConversion = useMutation({
    mutationFn: async ({ id, conversion_status, conversion_note }: { id: string; conversion_status: 'converted' | 'not_converted'; conversion_note?: string }) => {
      const { error } = await supabase
        .from('client_followups')
        .update({
          conversion_status,
          conversion_note: conversion_note || null,
          converted_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success(variables.conversion_status === 'converted' ? 'Marcado como convertido!' : 'Marcado como não convertido');
      const conversionLabel = variables.conversion_status === 'converted' ? 'Convertido' : 'Não convertido';
      logActivity(`Marcou conversão: ${conversionLabel}`, 'followup', `ID: ${variables.id}`);
    },
    onError: (err: any) => {
      toast.error('Erro ao marcar conversão: ' + err.message);
    },
  });

  const resolveFollowup = useMutation({
    mutationFn: async ({ id, reason, note }: { id: string; reason: string; note?: string }) => {
      const fullNote = note ? `${reason} — ${note}` : reason;
      const { error } = await supabase
        .from('client_followups')
        .update({
          status: 'resolved',
          conversion_note: fullNote,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up resolvido!');
      logActivity(`Resolveu follow-up: ${variables.reason}`, 'followup', `ID: ${variables.id}`);
    },
    onError: (err: any) => {
      toast.error('Erro ao resolver: ' + err.message);
    },
  });

  return {
    followups,
    isLoading,
    createFollowup,
    updateFollowup,
    cloneFollowup,
    cancelFollowup,
    deleteFollowup,
    retryFollowup,
    markConversion,
    resolveFollowup,
  };
}

export function useFollowupLogs(followupId: string | null) {
  return useQuery({
    queryKey: ['followup-logs', followupId],
    enabled: !!followupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_followup_logs')
        .select('*')
        .eq('followup_id', followupId!)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FollowupLog[];
    },
  });
}
