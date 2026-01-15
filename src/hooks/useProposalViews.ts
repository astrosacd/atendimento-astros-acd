import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProposalView {
  id: string;
  proposal_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function useProposalViews(proposalId: string | undefined) {
  const { data: views = [], isLoading } = useQuery({
    queryKey: ['proposal-views', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      
      const { data, error } = await supabase
        .from('proposal_views')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProposalView[];
    },
    enabled: !!proposalId,
  });

  return { views, isLoading };
}
