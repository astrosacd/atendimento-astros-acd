import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NumerosAlertConfig {
  id: string;
  is_active: boolean;
  status_to_monitor: string[];
  alert_interval_hours: number;
  alert_interval_minutes: number;
  message_template: string | null;
  last_alert_at: string | null;
  created_at: string;
  updated_at: string;
}

// Hook to fetch alert config
export function useNumerosAlertConfig() {
  return useQuery({
    queryKey: ['numeros-aquecimento-alert-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_alert_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as NumerosAlertConfig | null;
    },
  });
}

// Hook to update alert config
export function useUpdateNumerosAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<NumerosAlertConfig>) => {
      // First check if config exists
      const { data: existing } = await supabase
        .from('numeros_aquecimento_alert_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data: updated, error } = await supabase
          .from('numeros_aquecimento_alert_config')
          .update(data)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return updated;
      } else {
        // Insert new
        const { data: created, error } = await supabase
          .from('numeros_aquecimento_alert_config')
          .insert(data)
          .select()
          .single();
        
        if (error) throw error;
        return created;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-alert-config'] });
      toast.success('Configuração de alertas salva com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar configuração: ${error.message}`);
    },
  });
}

// Hook to check if there are numbers that need attention (for dashboard alert)
export function useNumerosAlertCheck() {
  return useQuery({
    queryKey: ['numeros-aquecimento-alert-check'],
    queryFn: async () => {
      // Get alert config
      const { data: config } = await supabase
        .from('numeros_aquecimento_alert_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!config || !config.is_active || !config.status_to_monitor?.length) {
        return { shouldAlert: false, numbers: [], config: null };
      }

      // Calculate if enough time has passed since last alert
      const intervalMs = (config.alert_interval_hours * 60 + (config.alert_interval_minutes || 0)) * 60 * 1000;
      const lastAlertTime = config.last_alert_at ? new Date(config.last_alert_at).getTime() : 0;
      const now = Date.now();
      
      if (lastAlertTime > 0 && (now - lastAlertTime) < intervalMs) {
        return { shouldAlert: false, numbers: [], config };
      }

      // Get numbers with monitored status
      const { data: numbers } = await supabase
        .from('numeros_aquecimento')
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(*),
          status:numeros_aquecimento_status(*)
        `)
        .in('status_id', config.status_to_monitor);

      return {
        shouldAlert: (numbers?.length || 0) > 0,
        numbers: numbers || [],
        config,
      };
    },
    refetchInterval: 60000, // Check every minute
    staleTime: 30000, // Consider fresh for 30 seconds
  });
}

// Hook to mark alert as shown (update last_alert_at)
export function useMarkAlertShown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: config } = await supabase
        .from('numeros_aquecimento_alert_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (!config) return null;

      const { error } = await supabase
        .from('numeros_aquecimento_alert_config')
        .update({ last_alert_at: new Date().toISOString() })
        .eq('id', config.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-alert-check'] });
    },
  });
}
