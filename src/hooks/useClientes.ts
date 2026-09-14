import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWebhooks } from '@/hooks/useWebhooks';
import { useClientHistory } from '@/hooks/useClientHistory';
import { logSystemActivity } from '@/hooks/useSystemActivities';
import { Json } from '@/integrations/supabase/types';

export type CicloCobranca = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

export const CICLO_MESES: Record<CicloCobranca, number> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export type Moeda = 'BRL' | 'USD';

export interface Cliente {
  id: string;
  nome: string;
  numero: string;
  produto: string;
  data_renovacao: string;
  email: string | null;
  cpf: string | null;
  plano: string | null;
  valor: number;
  moeda: Moeda;
  observacao: string | null;
  tags: string[] | null;
  cobranca_ativa: boolean;
  ciclo_cobranca: CicloCobranca;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tipo?: string;
  excluir_metricas?: boolean;
  cancelado_em?: string | null;
  status_cliente?: string | null;
  servico_agendado?: string | null;
  data_agendamento?: string | null;
  convertido_em?: string | null;
  convertido_de?: string | null;
}

export interface ClienteInput {
  nome: string;
  numero: string;
  produto: string;
  data_renovacao: string;
  email?: string;
  cpf?: string;
  plano?: string;
  valor: number;
  moeda?: Moeda;
  observacao?: string;
  tags?: string[];
  cobranca_ativa?: boolean;
  ciclo_cobranca?: CicloCobranca;
  tipo?: string;
  excluir_metricas?: boolean;
  status_cliente?: string;
  servico_agendado?: string | null;
  data_agendamento?: string | null;
  convertido_em?: string | null;
  convertido_de?: string | null;
}

export const useClientes = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { triggerWebhooks } = useWebhooks();
  const { logClientChange } = useClientHistory();

  const fetchClientes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Cliente[];
    } catch (error: any) {
      toast({
        title: 'Erro ao buscar clientes',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const searchCliente = async (query: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .or(`cpf.ilike.%${query}%,numero.ilike.%${query}%,nome.ilike.%${query}%,email.ilike.%${query}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Cliente[];
    } catch (error: any) {
      toast({
        title: 'Erro na consulta',
        description: error.message,
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createCliente = async (cliente: ClienteInput) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Normalizar tags (sempre array em minúsculas) para evitar inconsistências
      const normalizedTags = (cliente.tags && cliente.tags.length > 0)
        ? cliente.tags.map((tag) => tag.toLowerCase())
        : [];
      
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          ...cliente,
          tags: normalizedTags,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Garantir que todas as tags usadas pelo cliente sejam registradas em billing_config
      if (normalizedTags.length > 0) {
        try {
          const upsertPayload = normalizedTags.map((tag) => ({
            config_key: `tag_${tag.replace(/\s+/g, '_')}`,
            config_value: tag,
          }));

          await supabase
            .from('billing_config')
            .upsert(upsertPayload, { onConflict: 'config_key' });
        } catch (e) {
          console.error('Erro ao registrar tags em billing_config', e);
        }
      }
      
      toast({
        title: 'Cliente cadastrado com sucesso!',
        description: `${cliente.nome} foi adicionado ao sistema.`,
      });

      // Log history
      if (data) {
        await logClientChange(data.id, 'created', null, data as unknown as Json);
        triggerWebhooks('cliente.created', data);
        void logSystemActivity(`Cadastrou cliente: ${data.nome}`, 'cliente', `Produto: ${data.produto}`);
      }
      
      return data as Cliente;
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCliente = async (id: string, updates: Partial<ClienteInput>, previousData?: Cliente) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Cliente atualizado com sucesso!',
      });

      // Log history and trigger webhooks
      if (data) {
        await logClientChange(
          data.id, 
          'updated', 
          previousData as unknown as Json, 
          data as unknown as Json
        );
        triggerWebhooks('cliente.updated', data);
        void logSystemActivity(`Atualizou cliente: ${data.nome}`, 'cliente');
      }
      
      return data as Cliente;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar cliente',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCliente = async (id: string, clienteData?: Cliente) => {
    setIsLoading(true);
    try {
      // Log history BEFORE deleting (to avoid FK constraint issues)
      if (clienteData) {
        await logClientChange(id, 'deleted', clienteData as unknown as Json, null);
      }

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Cliente excluído com sucesso!',
      });

      // Trigger webhooks after successful deletion
      if (clienteData) {
        triggerWebhooks('cliente.deleted', { id, ...clienteData });
        void logSystemActivity(`Excluiu cliente: ${clienteData.nome}`, 'cliente');
      }
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir cliente',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    fetchClientes,
    searchCliente,
    createCliente,
    updateCliente,
    deleteCliente,
  };
};
