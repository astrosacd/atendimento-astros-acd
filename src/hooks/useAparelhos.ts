import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Aparelho {
  id: string;
  apelido: string;
  modelo_id: string | null;
  capacidade_total: number;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  modelo?: {
    id: string;
    nome: string;
    marca: string | null;
  } | null;
}

export type TipoWhatsapp = 'normal' | 'business';

export function useAparelhos() {
  return useQuery({
    queryKey: ['numeros-aquecimento-aparelhos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_aparelhos' as any)
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(id, nome, marca)
        `)
        .order('apelido');
      if (error) throw error;
      return (data || []) as unknown as Aparelho[];
    },
  });
}

export function useCreateAparelho() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      apelido: string;
      modelo_id: string | null;
      capacidade_total: number;
      observacoes?: string;
    }) => {
      const { data: aparelho, error } = await supabase
        .from('numeros_aquecimento_aparelhos' as any)
        .insert({ ...data, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return aparelho;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-aparelhos'] });
      toast.success('Aparelho cadastrado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar aparelho: ${error.message}`);
    },
  });
}

export function useUpdateAparelho() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Aparelho> }) => {
      const { data: aparelho, error } = await supabase
        .from('numeros_aquecimento_aparelhos' as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return aparelho;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-aparelhos'] });
      toast.success('Aparelho atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar aparelho: ${error.message}`);
    },
  });
}

export function useDeleteAparelho() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('numeros_aquecimento_aparelhos' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-aparelhos'] });
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento'] });
      toast.success('Aparelho excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir aparelho: ${error.message}`);
    },
  });
}

// Helper: Calcula ocupação de um aparelho baseado nos números cadastrados
export interface AparelhoOcupacao {
  aparelho: Aparelho;
  ocupados: number;
  livres: number;
  percentual: number;
  normal: number;
  business: number;
  status: 'vazio' | 'parcial' | 'cheio';
  numeros: Array<{ id: string; numero: string; tipo_whatsapp: TipoWhatsapp | null }>;
}

export function calcularOcupacao(
  aparelho: Aparelho,
  numeros: Array<{ id: string; numero: string; aparelho_id: string | null; tipo_whatsapp: string | null }>
): AparelhoOcupacao {
  const numerosDoAparelho = numeros
    .filter(n => n.aparelho_id === aparelho.id)
    .map(n => ({
      id: n.id,
      numero: n.numero,
      tipo_whatsapp: (n.tipo_whatsapp === 'business' ? 'business' : n.tipo_whatsapp === 'normal' ? 'normal' : null) as TipoWhatsapp | null,
    }));

  const ocupados = numerosDoAparelho.length;
  const normal = numerosDoAparelho.filter(n => n.tipo_whatsapp === 'normal').length;
  const business = numerosDoAparelho.filter(n => n.tipo_whatsapp === 'business').length;
  const livres = Math.max(0, aparelho.capacidade_total - ocupados);
  const percentual = aparelho.capacidade_total > 0 ? (ocupados / aparelho.capacidade_total) * 100 : 0;

  let status: 'vazio' | 'parcial' | 'cheio' = 'parcial';
  if (ocupados === 0) status = 'vazio';
  else if (ocupados >= aparelho.capacidade_total) status = 'cheio';

  return {
    aparelho,
    ocupados,
    livres,
    percentual,
    normal,
    business,
    status,
    numeros: numerosDoAparelho,
  };
}

// Sugere o tipo faltante baseado no que já tem
export function sugerirTipoFaltante(ocupacao: AparelhoOcupacao): string {
  if (ocupacao.livres === 0) return '';
  // Se só tem normal, sugere business; se só tem business, sugere normal; se misto, sugere o que tem menos
  if (ocupacao.normal > 0 && ocupacao.business === 0) return 'business';
  if (ocupacao.business > 0 && ocupacao.normal === 0) return 'normal';
  if (ocupacao.normal === 0 && ocupacao.business === 0) return 'normal ou business';
  return ocupacao.normal < ocupacao.business ? 'normal' : 'business';
}
