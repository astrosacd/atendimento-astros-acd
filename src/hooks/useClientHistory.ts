import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface ClientHistoryEntry {
  id: string;
  cliente_id: string | null;
  action: string;
  changed_by: string | null;
  changed_by_email: string | null;
  previous_data: Json | null;
  new_data: Json | null;
  changed_fields: string[] | null;
  created_at: string;
}

export const useClientHistory = () => {
  const logClientChange = async (
    clienteId: string,
    action: 'created' | 'updated' | 'deleted',
    previousData: Json | null,
    newData: Json | null
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    // Calculate changed fields for updates
    let changedFields: string[] = [];
    if (action === 'updated' && previousData && newData && typeof previousData === 'object' && typeof newData === 'object' && !Array.isArray(previousData) && !Array.isArray(newData)) {
      const prevObj = previousData as Record<string, Json>;
      const newObj = newData as Record<string, Json>;
      changedFields = Object.keys(newObj).filter(
        key => JSON.stringify(prevObj[key]) !== JSON.stringify(newObj[key])
      );
    }

    await supabase.from('client_history').insert([{
      cliente_id: clienteId,
      action,
      changed_by: user?.id || null,
      changed_by_email: user?.email || null,
      previous_data: previousData,
      new_data: newData,
      changed_fields: changedFields.length > 0 ? changedFields : null,
    }]);
  };

  const fetchClientHistory = async (clienteId?: string) => {
    let query = supabase
      .from('client_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data, error } = await query.limit(100);
    
    if (error) {
      console.error('Error fetching client history:', error);
      return [];
    }
    
    return data as ClientHistoryEntry[];
  };

  return {
    logClientChange,
    fetchClientHistory,
  };
};
