import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProposalBranding {
  id: string;
  logo_url: string | null;
  company_name: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  show_logo_on_cover: boolean;
  show_logo_on_pages: boolean;
  created_at: string;
  updated_at: string;
}

export function useProposalBranding() {
  const queryClient = useQueryClient();

  const { data: branding, isLoading } = useQuery({
    queryKey: ['proposal-branding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_branding')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ProposalBranding | null;
    },
  });

  const updateBranding = useMutation({
    mutationFn: async (updates: Partial<ProposalBranding>) => {
      if (branding?.id) {
        // Update existing
        const { data, error } = await supabase
          .from('proposal_branding')
          .update(updates)
          .eq('id', branding.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('proposal_branding')
          .insert(updates)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-branding'] });
      toast.success('Identidade visual salva com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving branding:', error);
      toast.error('Erro ao salvar identidade visual');
    },
  });

  return {
    branding,
    isLoading,
    updateBranding,
  };
}
