import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWebhooks } from '@/hooks/useWebhooks';
import { useClientHistory } from '@/hooks/useClientHistory';
import { Json } from '@/integrations/supabase/types';

export interface Cliente {
  id: string;
  nome: string;
  numero: string;
  produto: string;
  data_renovacao: string;
  email: string;
  cpf: string;
  plano: string | null;
  valor: number;
  observacao: string | null;
  tags: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteInput {
  nome: string;
  numero: string;
  produto: string;
  data_renovacao: string;
  email: string;
  cpf: string;
  plano?: string;
  valor: number;
  observacao?: string;
  tags?: string[];
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
        .or(`cpf.ilike.%${query}%,numero.ilike.%${query}%,nome.ilike.%${query}%`)
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
      
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          ...cliente,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Cliente cadastrado com sucesso!',
        description: `${cliente.nome} foi adicionado ao sistema.`,
      });

      // Log history
      if (data) {
        await logClientChange(data.id, 'created', null, data as unknown as Json);
        triggerWebhooks('cliente.created', data);
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
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Cliente excluído com sucesso!',
      });

      // Log history and trigger webhooks
      if (clienteData) {
        await logClientChange(id, 'deleted', clienteData as unknown as Json, null);
        triggerWebhooks('cliente.deleted', { id, ...clienteData });
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
