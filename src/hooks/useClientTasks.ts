import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ClientTask {
  id: string;
  cliente_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  assigned_to: string | null;
  assigned_to_email: string | null;
  created_by: string | null;
  created_by_email: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  cliente_nome?: string;
}

export interface CreateTaskInput {
  cliente_id?: string | null;
  title: string;
  description?: string;
  due_date?: string | null;
  priority?: 'baixa' | 'media' | 'alta' | 'urgente';
  assigned_to?: string | null;
  assigned_to_email?: string | null;
}

export const useClientTasks = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchTasks = async (filters?: {
    cliente_id?: string;
    status?: string;
    priority?: string;
    assigned_to?: string;
  }): Promise<ClientTask[]> => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('client_tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (filters?.cliente_id) {
        query = query.eq('cliente_id', filters.cliente_id);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as ClientTask[];
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTasksWithClients = async (filters?: {
    status?: string;
    priority?: string;
    assigned_to?: string;
  }): Promise<ClientTask[]> => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('client_tasks')
        .select(`
          *,
          clientes:cliente_id (nome)
        `)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map((task: any) => ({
        ...task,
        cliente_nome: task.clientes?.nome || null,
        clientes: undefined,
      })) as ClientTask[];
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createTask = async (input: CreateTaskInput): Promise<ClientTask | null> => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      const { data, error } = await supabase
        .from('client_tasks')
        .insert([{
          ...input,
          created_by: user?.id || null,
          created_by_email: user?.email || null,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Tarefa criada',
        description: 'A tarefa foi criada com sucesso.',
      });

      return data as ClientTask;
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTask = async (id: string, updates: Partial<ClientTask>): Promise<boolean> => {
    setIsLoading(true);
    try {
      // If marking as complete, set completed_at
      if (updates.status === 'concluida' && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      // If reopening, clear completed_at
      if (updates.status && updates.status !== 'concluida') {
        updates.completed_at = null;
      }

      const { error } = await supabase
        .from('client_tasks')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Tarefa atualizada',
        description: 'A tarefa foi atualizada com sucesso.',
      });

      return true;
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Erro ao atualizar tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTask = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('client_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Tarefa excluída',
        description: 'A tarefa foi excluída com sucesso.',
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Erro ao excluir tarefa',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getTaskStats = async (): Promise<{
    total: number;
    pendentes: number;
    em_andamento: number;
    concluidas: number;
    atrasadas: number;
  }> => {
    try {
      const { data, error } = await supabase
        .from('client_tasks')
        .select('status, due_date');

      if (error) throw error;

      const now = new Date();
      const stats = {
        total: data?.length || 0,
        pendentes: 0,
        em_andamento: 0,
        concluidas: 0,
        atrasadas: 0,
      };

      data?.forEach((task: any) => {
        if (task.status === 'pendente') stats.pendentes++;
        if (task.status === 'em_andamento') stats.em_andamento++;
        if (task.status === 'concluida') stats.concluidas++;
        
        // Check if overdue
        if (task.due_date && task.status !== 'concluida' && task.status !== 'cancelada') {
          if (new Date(task.due_date) < now) {
            stats.atrasadas++;
          }
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting task stats:', error);
      return { total: 0, pendentes: 0, em_andamento: 0, concluidas: 0, atrasadas: 0 };
    }
  };

  // Get urgent tasks (overdue or due within 1 day)
  const getUrgentTasks = async (): Promise<{
    overdue: ClientTask[];
    dueSoon: ClientTask[];
  }> => {
    try {
      const { data, error } = await supabase
        .from('client_tasks')
        .select(`
          *,
          clientes:cliente_id (nome)
        `)
        .in('status', ['pendente', 'em_andamento'])
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const tasks = (data || []).map((task: any) => ({
        ...task,
        cliente_nome: task.clientes?.nome || null,
        clientes: undefined,
      })) as ClientTask[];

      const overdue = tasks.filter(task => 
        task.due_date && new Date(task.due_date) < now
      );
      
      const dueSoon = tasks.filter(task => 
        task.due_date && 
        new Date(task.due_date) >= now && 
        new Date(task.due_date) <= tomorrow
      );

      return { overdue, dueSoon };
    } catch (error) {
      console.error('Error getting urgent tasks:', error);
      return { overdue: [], dueSoon: [] };
    }
  };

  return {
    isLoading,
    fetchTasks,
    fetchTasksWithClients,
    createTask,
    updateTask,
    deleteTask,
    getTaskStats,
    getUrgentTasks,
  };
};
