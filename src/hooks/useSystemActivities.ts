import { supabase } from "@/integrations/supabase/client";

export type ActivityType = 
  | 'consulta' 
  | 'pagamento' 
  | 'venda' 
  | 'duvida' 
  | 'cliente' 
  | 'config' 
  | 'lead_hunter'
  | 'numeros_aquecimento'
  | 'proposta'
  | 'tarefa'
  | 'webhook'
  | 'despesa'
  | 'followup'
  | 'admin'
  | 'contato'
  | 'chamado';

/**
 * Logs a system activity. Resilient to component unmount and missing auth context:
 * - Fetches user from Supabase session directly (doesn't depend on React state)
 * - Detached promise (fire-and-forget) but logs failures to console for debugging
 */
export async function logSystemActivity(
  action: string,
  resourceType: ActivityType,
  details?: string
) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('[logSystemActivity] No authenticated user, skipping log:', action);
      return;
    }

    const { error } = await supabase.from('system_activities').insert({
      user_id: user.id,
      action,
      resource_type: resourceType,
      details: details ?? null,
    });

    if (error) {
      console.error('[logSystemActivity] Insert failed:', error, { action, resourceType });
    }
  } catch (err) {
    console.error('[logSystemActivity] Unexpected error:', err, { action, resourceType });
  }
}

export function useSystemActivities() {
  // Wrapper kept for backwards-compatibility with all existing call sites.
  const logActivity = (action: string, resourceType: ActivityType, details?: string) => {
    // Fire-and-forget — but the promise itself is not tied to React state,
    // so it survives component unmount.
    void logSystemActivity(action, resourceType, details);
  };

  return { logActivity };
}
