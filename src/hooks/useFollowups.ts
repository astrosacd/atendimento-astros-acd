import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
}

export function useFollowups() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      toast.success('Follow-up agendado com sucesso!');
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
    },
    onError: (err: any) => {
      toast.error('Erro ao cancelar: ' + err.message);
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
    },
    onError: (err: any) => {
      toast.error('Erro ao excluir: ' + err.message);
    },
  });

  return {
    followups,
    isLoading,
    createFollowup,
    cancelFollowup,
    deleteFollowup,
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
