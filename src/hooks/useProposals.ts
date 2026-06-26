import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSystemActivities } from '@/hooks/useSystemActivities';
import type { Proposal, ProposalStatus } from '@/types/proposals';

export function useProposals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logActivity } = useSystemActivities();

  // Buscar todas as propostas
  const { data: rawProposals = [], isLoading, refetch } = useQuery({
    queryKey: ['proposals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select(`
          *,
          client:clientes(id, nome, email, numero)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        user_id: string;
        client_id: string | null;
        manual_client_name: string | null;
        manual_client_email: string | null;
        manual_client_phone: string | null;
        client: { id: string; nome: string; email: string; numero: string } | null;
        [key: string]: unknown;
      }>;
    },
    enabled: !!user,
  });

  // Buscar informações dos criadores
  const userIds = [...new Set(rawProposals.map(p => p.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['proposal-creators', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  // Buscar canais de envio de todas as propostas
  const proposalIds = rawProposals.map(p => p.id);
  const { data: sendLogs = [] } = useQuery({
    queryKey: ['proposal-send-channels', proposalIds],
    queryFn: async () => {
      if (proposalIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('proposal_send_logs')
        .select('proposal_id, channel, sent_at')
        .in('proposal_id', proposalIds)
        .in('status', ['success', 'sent'])
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: proposalIds.length > 0,
  });

  // Combinar propostas com criadores
  const proposals: Proposal[] = rawProposals.map(proposal => {
    const creator = profiles.find(p => p.user_id === proposal.user_id);
    return {
      ...proposal,
      creator: creator ? { id: creator.user_id, name: creator.name, email: creator.email } : null,
    } as Proposal;
  });

  // Agrupar canais por proposta (canais únicos)
  const proposalSendChannels: Record<string, string[]> = {};
  sendLogs.forEach(log => {
    if (!proposalSendChannels[log.proposal_id]) {
      proposalSendChannels[log.proposal_id] = [];
    }
    if (!proposalSendChannels[log.proposal_id].includes(log.channel)) {
      proposalSendChannels[log.proposal_id].push(log.channel);
    }
  });

  // Buscar proposta por ID
  const useProposal = (id: string | undefined) => {
    return useQuery({
      queryKey: ['proposal', id],
      queryFn: async () => {
        if (!id) return null;
        const { data, error } = await supabase
          .from('proposals')
          .select(`
            *,
            client:clientes(id, nome, email, numero)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        return data as Proposal;
      },
      enabled: !!id && !!user,
    });
  };

  // Criar proposta
  const createProposal = useMutation({
    mutationFn: async (title?: string) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          user_id: user.id,
          title: title || 'Nova Proposta',
          status: 'draft' as ProposalStatus,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      logActivity(`Criou nova proposta: ${data.title}`, 'proposta');
    },
    onError: (error) => {
      console.error('Erro ao criar proposta:', error);
      toast.error('Erro ao criar proposta');
    },
  });

  // Atualizar proposta
  const updateProposal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Proposal> & { id: string }) => {
      const { data, error } = await supabase
        .from('proposals')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', data.id] });
      logActivity(`Atualizou proposta: ${data.title}`, 'proposta');
    },
    onError: (error) => {
      console.error('Erro ao atualizar proposta:', error);
      toast.error('Erro ao atualizar proposta');
    },
  });

  // Deletar proposta
  const deleteProposal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposta excluída');
      logActivity(`Excluiu uma proposta`, 'proposta');
    },
    onError: (error) => {
      console.error('Erro ao excluir proposta:', error);
      toast.error('Erro ao excluir proposta');
    },
  });

  // Calcular estatísticas
  const stats = {
    total: proposals.length,
    draft: proposals.filter(p => p.status === 'draft').length,
    sent: proposals.filter(p => p.status === 'sent').length,
    viewed: proposals.filter(p => p.status === 'viewed').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
    totalValue: proposals.reduce((sum, p) => sum + (p.total_value || 0), 0),
  };

  return {
    proposals,
    isLoading,
    refetch,
    stats,
    useProposal,
    createProposal,
    updateProposal,
    deleteProposal,
    proposalSendChannels,
  };
}
