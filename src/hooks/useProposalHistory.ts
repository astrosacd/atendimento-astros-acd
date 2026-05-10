import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface ProposalHistoryEntry {
  id: string;
  proposal_id: string;
  action: 'created' | 'updated' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'remarketing' | 'remarketing_restarted';
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  changes: Json | null;
  created_at: string;
}

export function useProposalHistory(proposalId: string | undefined) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['proposal-history', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];

      const { data, error } = await supabase
        .from('proposal_history')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar histórico:', error);
        return [];
      }

      return data as ProposalHistoryEntry[];
    },
    enabled: !!proposalId,
  });

  return { history, isLoading };
}

export function useLogProposalAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      proposalId,
      action,
      changes,
    }: {
      proposalId: string;
      action: ProposalHistoryEntry['action'];
      changes?: Json;
    }) => {
      // Get user profile
      let userName = user?.email?.split('@')[0] || 'Usuário';
      
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.name) {
          userName = profile.name;
        }
      }

      const { error } = await supabase
        .from('proposal_history')
        .insert([{
          proposal_id: proposalId,
          action,
          user_id: user?.id || null,
          user_email: user?.email || null,
          user_name: userName,
          changes: changes || null,
        }]);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-history', variables.proposalId] });
    },
  });
}
