import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  website?: string;
}

export interface ClientLogo {
  id: string;
  url: string;
  name?: string;
}

export interface Certification {
  id: string;
  url: string;
  name: string;
}

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
  cover_background_url: string | null;
  tagline: string | null;
  footer_contact: string | null;
  footer_website: string | null;
  footer_social: SocialLinks;
  client_logos: ClientLogo[];
  certifications: Certification[];
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
      
      if (data) {
        return {
          ...data,
          footer_social: (data.footer_social || {}) as unknown as SocialLinks,
          client_logos: (data.client_logos || []) as unknown as ClientLogo[],
          certifications: (data.certifications || []) as unknown as Certification[],
        } as ProposalBranding;
      }
      
      return null;
    },
  });

  const updateBranding = useMutation({
    mutationFn: async (updates: Partial<ProposalBranding>) => {
      // Convert arrays/objects to Json type for Supabase
      const payload = {
        ...updates,
        footer_social: updates.footer_social as unknown as Json,
        client_logos: updates.client_logos as unknown as Json,
        certifications: updates.certifications as unknown as Json,
      };

      if (branding?.id) {
        // Update existing
        const { data, error } = await supabase
          .from('proposal_branding')
          .update(payload)
          .eq('id', branding.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('proposal_branding')
          .insert(payload)
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
