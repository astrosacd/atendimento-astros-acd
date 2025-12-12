import { supabase } from '@/integrations/supabase/client';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    cliente: Record<string, unknown>;
    usuario: {
      id: string;
      email: string;
      name: string;
    };
  };
}

export const useWebhooks = () => {
  const triggerWebhooks = async (
    eventType: 'cliente.created' | 'cliente.updated' | 'cliente.deleted',
    clienteData: Record<string, unknown>
  ) => {
    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', user.id)
        .single();

      // Get active webhooks that listen to this event
      const { data: webhooks, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('is_active', true)
        .contains('events', [eventType]);

      if (error || !webhooks?.length) return;

      const payload: WebhookPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: {
          cliente: clienteData,
          usuario: {
            id: user.id,
            email: user.email || '',
            name: profile?.name || user.email || '',
          },
        },
      };

      // Send to all active webhooks
      const promises = webhooks.map(async (webhook) => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (webhook.secret_key) {
            headers['X-Webhook-Secret'] = webhook.secret_key;
          }

          await fetch(webhook.url, {
            method: 'POST',
            headers,
            mode: 'no-cors',
            body: JSON.stringify(payload),
          });

          console.log(`Webhook triggered: ${webhook.name} for event ${eventType}`);
        } catch (err) {
          console.error(`Failed to trigger webhook ${webhook.name}:`, err);
        }
      });

      await Promise.all(promises);
    } catch (err) {
      console.error('Error triggering webhooks:', err);
    }
  };

  return { triggerWebhooks };
};
