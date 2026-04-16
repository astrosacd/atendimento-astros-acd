import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ActivityType = 
  | 'consulta' 
  | 'pagamento' 
  | 'venda' 
  | 'duvida' 
  | 'cliente' 
  | 'config' 
  | 'lead_hunter'
  | 'numeros_aquecimento';

export function useSystemActivities() {
  const { user } = useAuth();

  const logActivity = async (action: string, resourceType: ActivityType, details?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('system_activities').insert({
        user_id: user.id,
        action,
        resource_type: resourceType,
        details
      });

      if (error) {
        console.error('Error logging activity:', error);
      }
    } catch (err) {
      console.error('Error in logActivity:', err);
    }
  };

  return { logActivity };
}
