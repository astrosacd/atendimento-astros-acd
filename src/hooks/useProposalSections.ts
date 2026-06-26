// Hook for managing proposal sections
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Section types
export type SectionType = 
  | 'cover' 
  | 'text' 
  | 'pricing' 
  | 'timeline' 
  | 'team' 
  | 'testimonials' 
  | 'gallery' 
  | 'terms' 
  | 'signature'
  | 'video'
  | 'faq'
  | 'benefits'
  | 'process'
  | 'links';

// Local interface to avoid circular dependencies
export interface ProposalSection {
  id: string;
  proposal_id: string;
  section_type: SectionType | string;
  title: string | null;
  content: Record<string, unknown>;
  order_index: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export function useProposalSections(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  // Buscar seções da proposta
  const { data: sections = [], isLoading, refetch } = useQuery({
    queryKey: ['proposal-sections', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      
      const { data, error } = await supabase
        .from('proposal_sections')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as ProposalSection[];
    },
    enabled: !!proposalId,
  });

  // Criar seção
  const createSection = useMutation({
    mutationFn: async ({ 
      type, 
      title 
    }: { 
      type: SectionType; 
      title?: string;
    }) => {
      if (!proposalId) throw new Error('ID da proposta não fornecido');

      const maxOrder = sections.length > 0 
        ? Math.max(...sections.map(s => s.order_index)) 
        : -1;

      const insertData = {
        proposal_id: proposalId,
        section_type: type as string,
        title: title || null,
        order_index: maxOrder + 1,
        content: getDefaultContent(type) as Json,
      };

      const { data, error } = await supabase
        .from('proposal_sections')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-sections', proposalId] });
      toast.success('Seção adicionada');
    },
    onError: (error) => {
      console.error('Erro ao criar seção:', error);
      toast.error('Erro ao adicionar seção');
    },
  });

  // Atualizar seção
  // skipOptimistic: when caller already applied optimistic state (e.g. debounced typing)
  const updateSection = useMutation({
    mutationFn: async ({ id, skipOptimistic, ...updates }: Partial<ProposalSection> & { id: string; skipOptimistic?: boolean }) => {
      const updateData: Record<string, Json | string | number | boolean | null> = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.content !== undefined) updateData.content = updates.content as Json;
      if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;
      if (updates.order_index !== undefined) updateData.order_index = updates.order_index;

      const { data, error } = await supabase
        .from('proposal_sections')
        .update(updateData as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      // Return skipOptimistic flag along with data so onSuccess knows whether to update cache
      return { section: data as ProposalSection, skipOptimistic };
    },
    onMutate: async (variables) => {
      // Skip optimistic update if caller already applied it
      if (variables.skipOptimistic) {
        return { previous: null };
      }

      // Optimistic update to prevent UI lag while typing
      await queryClient.cancelQueries({ queryKey: ['proposal-sections', proposalId] });

      const previous = queryClient.getQueryData<ProposalSection[]>([
        'proposal-sections',
        proposalId,
      ]);

      if (previous) {
        queryClient.setQueryData<ProposalSection[]>(['proposal-sections', proposalId],
          previous.map((s) => {
            if (s.id !== variables.id) return s;
            return {
              ...s,
              ...(variables.title !== undefined ? { title: variables.title ?? s.title } : {}),
              ...(variables.content !== undefined ? { content: (variables.content ?? s.content) as Record<string, unknown> } : {}),
              ...(variables.is_visible !== undefined ? { is_visible: variables.is_visible ?? s.is_visible } : {}),
              ...(variables.order_index !== undefined ? { order_index: variables.order_index ?? s.order_index } : {}),
              // keep updated_at optimistic to avoid flicker
              updated_at: new Date().toISOString(),
            };
          })
        );
      }

      return { previous };
    },
    onError: (error, _vars, context) => {
      console.error('Erro ao atualizar seção:', error);
      if (context?.previous) {
        queryClient.setQueryData(['proposal-sections', proposalId], context.previous);
      }
      toast.error('Erro ao atualizar seção');
    },
    onSuccess: (result) => {
      // If skipOptimistic was used, the caller already updated the cache optimistically
      // Don't overwrite it with stale server data that could undo typing in progress
      if (result.skipOptimistic) {
        return;
      }
      // Replace optimistic section with the server version without refetching everything
      queryClient.setQueryData<ProposalSection[]>(['proposal-sections', proposalId], (current) => {
        if (!current) return [result.section];
        return current.map((s) => (s.id === result.section.id ? result.section : s));
      });
    },
  });

  // Deletar seção
  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('proposal_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-sections', proposalId] });
      toast.success('Seção removida');
    },
    onError: (error) => {
      console.error('Erro ao excluir seção:', error);
      toast.error('Erro ao remover seção');
    },
  });

  // Reordenar seções
  const reorderSections = useMutation({
    mutationFn: async (reorderedSections: ProposalSection[]) => {
      const updates = reorderedSections.map((section, index) => ({
        id: section.id,
        order_index: index,
      }));

      // Atualiza em paralelo (mais rápido) — update permite payload parcial.
      const results = await Promise.all(
        updates.map(async (u) => {
          const { error } = await supabase
            .from('proposal_sections')
            .update({ order_index: u.order_index })
            .eq('id', u.id);
          if (error) throw error;
          return u;
        })
      );

      return results;
    },
    onMutate: async (reorderedSections) => {
      await queryClient.cancelQueries({ queryKey: ['proposal-sections', proposalId] });

      const previous = queryClient.getQueryData<ProposalSection[]>(['proposal-sections', proposalId]);

      // Otimista: aplica a nova ordem imediatamente (evita "voltar" e depois ajustar)
      queryClient.setQueryData<ProposalSection[]>(['proposal-sections', proposalId], () =>
        reorderedSections.map((s, index) => ({
          ...s,
          order_index: index,
          updated_at: new Date().toISOString(),
        }))
      );

      return { previous };
    },
    onError: (error, _vars, context) => {
      console.error('Erro ao reordenar seções:', error);
      if (context?.previous) {
        queryClient.setQueryData(['proposal-sections', proposalId], context.previous);
      }
      toast.error('Erro ao reordenar seções');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-sections', proposalId] });
    },
  });

  return {
    sections,
    isLoading,
    refetch,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
  };
}

// Conteúdo padrão por tipo de seção
function getDefaultContent(type: SectionType): Record<string, unknown> {
  switch (type) {
    case 'cover':
      return { title: '', subtitle: '', backgroundImage: '' };
    case 'text':
      return { content: '' };
    case 'pricing':
      return { items: [] };
    case 'timeline':
      return { items: [] };
    case 'team':
      return { members: [] };
    case 'testimonials':
      return { items: [] };
    case 'gallery':
      return { images: [] };
    case 'terms':
      return { content: '' };
    case 'signature':
      return { signerName: '', signerRole: '', signerSignature: '' };
    case 'video':
      return { url: '', caption: '' };
    case 'faq':
      return { items: [] };
    case 'benefits':
      return { items: [] };
    case 'process':
      return { steps: [] };
    case 'links':
      return { items: [] };
    default:
      return {};
  }
}
