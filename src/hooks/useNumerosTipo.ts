import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NumeroTipo {
  id: string;
  baserow_row_id: string;
  tipo: 'EX' | 'IN';
  created_at: string;
}

// Hook para buscar tipos de todos os números carregados
export function useNumerosTipos(rowIds: string[]) {
  return useQuery({
    queryKey: ['consulta-numeros-tipos', rowIds.sort().join(',')],
    queryFn: async () => {
      if (!rowIds.length) return {};
      
      const { data, error } = await supabase
        .from('consulta_numeros_tipo')
        .select('*')
        .in('baserow_row_id', rowIds);
      
      if (error) throw error;
      
      // Retorna um mapa de baserow_row_id -> tipo
      const tipoMap: Record<string, 'EX' | 'IN'> = {};
      data?.forEach((item: NumeroTipo) => {
        tipoMap[item.baserow_row_id] = item.tipo;
      });
      
      return tipoMap;
    },
    enabled: rowIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Hook para criar/atualizar tipo de um número
export function useSetNumeroTipo() {
  return useMutation({
    mutationFn: async ({ baserowRowId, tipo }: { baserowRowId: string; tipo: 'EX' | 'IN' }) => {
      // Tenta inserir, ignorando se já existir (UNIQUE constraint)
      const { error } = await supabase
        .from('consulta_numeros_tipo')
        .upsert(
          { baserow_row_id: baserowRowId, tipo },
          { onConflict: 'baserow_row_id', ignoreDuplicates: true }
        );
      
      if (error) throw error;
      return { baserowRowId, tipo };
    },
    // Não invalida queries para evitar re-render desnecessário
    // O tipo já está sendo controlado pelo processedTipoIds no componente
  });
}

// Função para detectar o tipo baseado na observação
export function detectarTipo(observacao: string | null | undefined): 'EX' | 'IN' {
  if (!observacao) return 'IN'; // Sem observação = interno
  
  const obsLower = observacao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Se contém "numero externo" = Externo
  if (/numero\s*externo/i.test(obsLower)) {
    return 'EX';
  }
  
  // Se contém "com seguro" ou "sem seguro" = Interno
  if (obsLower.includes('com seguro') || obsLower.includes('sem seguro')) {
    return 'IN';
  }
  
  // Padrão: interno
  return 'IN';
}
