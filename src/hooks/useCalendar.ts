import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logSystemActivity } from '@/hooks/useSystemActivities';
import { toast } from 'sonner';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  start_time: string;
  end_time: string;
  meet_link: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarConfig {
  id: string;
  config_key: string;
  config_value: string;
}

export function useCalendarEvents(month?: Date) {
  return useQuery({
    queryKey: ['calendar-events', month?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('calendar_events')
        .select('*')
        .order('start_time', { ascending: true });

      if (month) {
        const start = new Date(month.getFullYear(), month.getMonth(), 1);
        const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
        query = query.gte('start_time', start.toISOString()).lte('start_time', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useCalendarConfig() {
  return useQuery({
    queryKey: ['calendar-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_config')
        .select('*');
      if (error) throw error;
      
      const configMap: Record<string, string> = {};
      (data as CalendarConfig[]).forEach(item => {
        configMap[item.config_key] = item.config_value;
      });
      return configMap;
    },
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({ ...event, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Evento criado com sucesso!');
      void logSystemActivity(`Criou evento na agenda: ${data?.title || 'Sem título'}`, 'config');
    },
    onError: (error) => {
      toast.error('Erro ao criar evento: ' + error.message);
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CalendarEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Evento atualizado com sucesso!');
      void logSystemActivity(`Atualizou evento na agenda: ${data?.title || 'Sem título'}`, 'config');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar evento: ' + error.message);
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Evento excluído com sucesso!');
      void logSystemActivity('Excluiu um evento da agenda', 'config');
    },
    onError: (error) => {
      toast.error('Erro ao excluir evento: ' + error.message);
    },
  });
}

export function useUpdateCalendarConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configs: Record<string, string>) => {
      const promises = Object.entries(configs).map(([key, value]) =>
        supabase
          .from('calendar_config')
          .update({ config_value: value })
          .eq('config_key', key)
      );
      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-config'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configurações: ' + error.message);
    },
  });
}
