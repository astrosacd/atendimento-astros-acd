import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConsultaNumerosCacheRow {
  baserow_row_id: number;
  row_data: any;
  auto_hospedado?: boolean | null;
}

/**
 * Fonte única do cache local de números.
 *
 * Antes, cada tela (página de consulta, card do dashboard, painel de status
 * monitorados) baixava a tabela inteira por conta própria — e a página ainda
 * rebaixava tudo a cada troca de página/filtro. Isso gerava milhares de
 * downloads repetidos da mesma tabela (jsonb pesado) e deixava o módulo lento.
 *
 * Agora todos compartilham a MESMA queryKey, então o React Query serve o
 * resultado em memória e só refaz a requisição quando o cache expira ou é
 * invalidado.
 */
export function useConsultaNumerosCacheRows(enabled: boolean = true) {
  return useQuery({
    queryKey: ['consulta-numeros', 'cache-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_cache')
        .select('baserow_row_id, row_data, auto_hospedado')
        .order('baserow_row_id');
      if (error) throw error;
      return (data ?? []) as ConsultaNumerosCacheRow[];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
