import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSystemActivities } from '@/hooks/useSystemActivities';

export interface ClientTask {
  id: string;
  codigo: string | null;
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
  created_by_name?: string;
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

export interface TaskHistoryEntry {
  id: string;
  task_id: string | null;
  action: 'created' | 'updated' | 'deleted' | 'status_changed';
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  previous_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_fields: string[] | null;
  deletion_reason: string | null;
  created_at: string;
}

export const useClientTasks = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { logActivity } = useSystemActivities();

  // Helper function to log task history
  const logTaskHistory = async (
    taskId: string | null,
    action: 'created' | 'updated' | 'deleted' | 'status_changed',
    previousData: Record<string, any> | null,
    newData: Record<string, any> | null,
    changedFields: string[] | null,
    deletionReason?: string | null
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      // Get user name from profiles
      let userName = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();
        userName = profile?.name || null;
      }

      await supabase
        .from('client_tasks_history')
        .insert({
          task_id: taskId,
          action,
          user_id: user?.id || null,
          user_email: user?.email || null,
          user_name: userName,
          previous_data: previousData,
          new_data: newData,
          changed_fields: changedFields,
          deletion_reason: deletionReason || null,
        });
    } catch (error) {
      console.error('Error logging task history:', error);
    }
  };

  // Calculate changed fields between two objects
  const getChangedFields = (
    previous: Record<string, any>,
    updated: Record<string, any>
  ): string[] => {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(updated)]);
    
    allKeys.forEach(key => {
      // Skip internal fields
      if (['updated_at', 'created_at', 'id'].includes(key)) return;
      
      if (JSON.stringify(previous[key]) !== JSON.stringify(updated[key])) {
        changedFields.push(key);
      }
    });
    
    return changedFields;
  };

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
      
      // Fetch creator names separately
      const tasks = data || [];
      const creatorIds = [...new Set(tasks.map((t: any) => t.created_by).filter(Boolean))];
      
      let creatorNames: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', creatorIds);
        
        if (profiles) {
          profiles.forEach((p: any) => {
            creatorNames[p.user_id] = p.name;
          });
        }
      }
      
      return tasks.map((task: any) => ({
        ...task,
        cliente_nome: task.clientes?.nome || null,
        created_by_name: task.created_by ? creatorNames[task.created_by] || null : null,
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

      // Log history
      await logTaskHistory(data.id, 'created', null, data, null);

      toast({
        title: 'Tarefa criada',
        description: 'A tarefa foi criada com sucesso.',
      });

      logActivity(`Criou nova tarefa: ${data.title}`, 'tarefa');

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
      // Fetch current task data before update
      const { data: previousTask, error: fetchError } = await supabase
        .from('client_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // If marking as complete, set completed_at
      if (updates.status === 'concluida' && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      // If reopening, clear completed_at
      if (updates.status && updates.status !== 'concluida') {
        updates.completed_at = null;
      }

      const { data: updatedTask, error } = await supabase
        .from('client_tasks')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Determine action type and changed fields
      const changedFields = getChangedFields(previousTask, updatedTask);
      const action = changedFields.length === 1 && changedFields[0] === 'status' 
        ? 'status_changed' 
        : 'updated';

      // Log history
      await logTaskHistory(id, action, previousTask, updatedTask, changedFields);

      toast({
        title: 'Tarefa atualizada',
        description: 'A tarefa foi atualizada com sucesso.',
      });

      logActivity(`Atualizou tarefa: ${updatedTask.title}`, 'tarefa', `Status: ${updatedTask.status}`);

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

  const deleteTask = async (id: string, deletionReason?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Fetch task data before delete
      const { data: taskData, error: fetchError } = await supabase
        .from('client_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Log history BEFORE delete (because task_id will be null after delete)
      await logTaskHistory(id, 'deleted', taskData, null, null, deletionReason);

      const { error } = await supabase
        .from('client_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Tarefa excluída',
        description: 'A tarefa foi excluída com sucesso.',
      });

      logActivity(`Excluiu uma tarefa: ${taskData.title}`, 'tarefa');

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

  const fetchTaskHistory = async (taskId?: string): Promise<TaskHistoryEntry[]> => {
    try {
      let query = supabase
        .from('client_tasks_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as TaskHistoryEntry[];
    } catch (error: any) {
      console.error('Error fetching task history:', error);
      return [];
    }
  };

  const getTaskStats = useCallback(async (): Promise<{
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
  }, []);

  // Get urgent tasks (overdue or due within 1 day)
  const getUrgentTasks = useCallback(async (): Promise<{
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
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      
      const tasks = (data || []).map((task: any) => ({
        ...task,
        cliente_nome: task.clientes?.nome || null,
        clientes: undefined,
      })) as ClientTask[];

      const overdue = tasks.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return dueDateOnly < today;
      });
      
      const dueSoon = tasks.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return dueDateOnly.getTime() === today.getTime();
      });

      return { overdue, dueSoon };
    } catch (error) {
      console.error('Error getting urgent tasks:', error);
      return { overdue: [], dueSoon: [] };
    }
  }, []);

  return {
    isLoading,
    fetchTasks,
    fetchTasksWithClients,
    createTask,
    updateTask,
    deleteTask,
    fetchTaskHistory,
    getTaskStats,
    getUrgentTasks,
  };
};
