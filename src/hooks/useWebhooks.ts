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

      // Send to all active webhooks via Edge Function proxy for CORS-free delivery
      const promises = webhooks.map(async (webhook) => {
        try {
          // Use the webhook-proxy Edge Function to bypass CORS
          const { data, error: proxyError } = await supabase.functions.invoke('webhook-proxy', {
            body: {
              webhookId: webhook.id,
              payload,
            },
          });

          if (proxyError) {
            console.error(`Webhook proxy error for ${webhook.name}:`, proxyError);
            // Fallback to direct fetch if proxy fails
            await sendDirectWebhook(webhook, payload);
          } else {
            console.log(`Webhook triggered via proxy: ${webhook.name} for event ${eventType}`, data);
          }
        } catch (err) {
          console.error(`Failed to trigger webhook ${webhook.name}:`, err);
          // Fallback to direct fetch
          await sendDirectWebhook(webhook, payload);
        }
      });

      await Promise.all(promises);
    } catch (err) {
      console.error('Error triggering webhooks:', err);
    }
  };

  // Fallback direct webhook send (may fail due to CORS)
  const sendDirectWebhook = async (
    webhook: { url: string; secret_key: string | null; name: string },
    payload: WebhookPayload
  ) => {
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
        body: JSON.stringify(payload, null, 2),
      });

      console.log(`Webhook sent directly (no-cors): ${webhook.name}`);
    } catch (err) {
      console.error(`Direct webhook failed for ${webhook.name}:`, err);
    }
  };

  return { triggerWebhooks };
};
