import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Proposal, ProposalStatus } from '@/types/proposals';

export function useProposals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar todas as propostas
  const { data: proposals = [], isLoading, refetch } = useQuery({
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
      return data as Proposal[];
    },
    enabled: !!user,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
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
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', data.id] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Proposta excluída');
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
  };
}
