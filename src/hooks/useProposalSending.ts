import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProposalSendConfig {
  id: string;
  gmail_user: string | null;
  gmail_app_password: string | null;
  gmail_sender_name: string | null;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  email_subject_template: string | null;
  email_body_template: string | null;
  whatsapp_message_template: string | null;
  auto_remarketing_enabled: boolean;
  auto_remarketing_max_days: number;
  auto_remarketing_channel: string;
}

export interface ProposalSendLog {
  id: string;
  proposal_id: string;
  channel: 'email' | 'whatsapp';
  recipient: string;
  status: 'pending' | 'sent' | 'error';
  error_message: string | null;
  sent_at: string;
  sent_by: string | null;
  sent_by_email: string | null;
}

export function useProposalSendConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['proposal-send-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_send_config')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configuração de envio:', error);
        return null;
      }

      return data as ProposalSendConfig | null;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<ProposalSendConfig>) => {
      if (!config?.id) {
        // Create new config
        const { data, error } = await supabase
          .from('proposal_send_config')
          .insert(updates)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('proposal_send_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', config.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-send-config'] });
      toast.success('Configuração salva!');
    },
    onError: (error: any) => {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    },
  });

  return {
    config,
    isLoading,
    updateConfig,
  };
}

export function useProposalSendLogs(proposalId: string | undefined) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['proposal-send-logs', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];

      const { data, error } = await supabase
        .from('proposal_send_logs')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar logs de envio:', error);
        return [];
      }

      return data as ProposalSendLog[];
    },
    enabled: !!proposalId,
  });

  return { logs, isLoading };
}

export function useSendProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      channel,
      recipientEmail,
      recipientPhone,
      recipientName,
      enablePasswordProtection,
      autoPassword,
      passwordChannel,
      isRemarketing,
      remarketingMessage,
    }: {
      proposalId: string;
      channel: 'email' | 'whatsapp' | 'both';
      recipientEmail?: string;
      recipientPhone?: string;
      recipientName?: string;
      enablePasswordProtection?: boolean;
      autoPassword?: string;
      passwordChannel?: 'whatsapp' | 'email';
      isRemarketing?: boolean;
      remarketingMessage?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-proposal', {
        body: {
          proposalId,
          channel,
          recipientEmail,
          recipientPhone,
          recipientName,
          enablePasswordProtection,
          autoPassword,
          passwordChannel,
          isRemarketing,
          remarketingMessage,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', variables.proposalId] });
      queryClient.invalidateQueries({ queryKey: ['proposal-send-logs', variables.proposalId] });

      if (data.success) {
        const channels: string[] = [];
        if (data.results?.email?.sent) channels.push('Email');
        if (data.results?.whatsapp?.sent) channels.push('WhatsApp');
        const action = variables.isRemarketing ? 'Remarketing enviado' : 'Proposta enviada';
        toast.success(`${action} via ${channels.join(' e ')}!`);
      } else {
        const errors: string[] = [];
        if (data.results?.email?.error) errors.push(`Email: ${data.results.email.error}`);
        if (data.results?.whatsapp?.error) errors.push(`WhatsApp: ${data.results.whatsapp.error}`);
        toast.error(`Falha no envio: ${errors.join('; ')}`);
      }
    },
    onError: (error: any) => {
      console.error('Erro ao enviar proposta:', error);
      toast.error(error?.message || 'Erro ao enviar proposta');
    },
  });
}
