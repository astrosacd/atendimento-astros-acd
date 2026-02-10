import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScheduledSend {
  id: string;
  proposal_id: string;
  scheduled_at: string;
  channel: 'email' | 'whatsapp' | 'both';
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  enable_password_protection: boolean;
  status: 'pending' | 'sent' | 'error' | 'cancelled';
  error_message: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

export function useScheduledSends(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: scheduledSends = [], isLoading } = useQuery({
    queryKey: ['scheduled-sends', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from('proposal_scheduled_sends')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('scheduled_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar agendamentos:', error);
        return [];
      }
      return data as ScheduledSend[];
    },
    enabled: !!proposalId,
  });

  const createScheduledSend = useMutation({
    mutationFn: async (params: {
      proposalId: string;
      scheduledAt: string;
      channel: 'email' | 'whatsapp' | 'both';
      recipientName?: string;
      recipientEmail?: string;
      recipientPhone?: string;
      enablePasswordProtection?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('proposal_scheduled_sends')
        .insert({
          proposal_id: params.proposalId,
          scheduled_at: params.scheduledAt,
          channel: params.channel,
          recipient_name: params.recipientName || null,
          recipient_email: params.recipientEmail || null,
          recipient_phone: params.recipientPhone || null,
          enable_password_protection: params.enablePasswordProtection || false,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-sends', proposalId] });
      toast.success('Envio agendado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao agendar envio:', error);
      toast.error('Erro ao agendar envio');
    },
  });

  const cancelScheduledSend = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('proposal_scheduled_sends')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', scheduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-sends', proposalId] });
      toast.success('Agendamento cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar agendamento');
    },
  });

  return {
    scheduledSends,
    isLoading,
    createScheduledSend,
    cancelScheduledSend,
  };
}
