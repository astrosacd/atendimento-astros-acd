import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { webhookId, payload } = body;

    if (!webhookId || !payload) {
      return new Response(
        JSON.stringify({ error: 'Missing webhookId or payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch webhook configuration
    const { data: webhook, error: webhookError } = await supabaseClient
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .eq('is_active', true)
      .single();

    if (webhookError || !webhook) {
      console.log('Webhook not found or inactive:', webhookId);
      return new Response(
        JSON.stringify({ error: 'Webhook not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (webhook.secret_key) {
      headers['X-Webhook-Secret'] = webhook.secret_key;
    }

    // Format payload nicely
    const formattedPayload = JSON.stringify(payload, null, 2);

    console.log(`Sending webhook to: ${webhook.url}`);
    console.log(`Payload:`, formattedPayload);

    // Send webhook request
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: formattedPayload,
    });

    const responseText = await response.text();
    console.log(`Webhook response status: ${response.status}`);
    console.log(`Webhook response body: ${responseText}`);

    // Log to audit
    await supabaseClient.rpc('insert_audit_log', {
      p_action: 'webhook_sent',
      p_resource_type: 'webhook',
      p_resource_id: webhookId,
      p_webhook_id: webhookId,
      p_request_method: 'POST',
      p_request_path: webhook.url,
      p_request_body: payload,
      p_response_status: response.status,
      p_response_body: { text: responseText.substring(0, 1000) },
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: response.status,
        webhookName: webhook.name,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Webhook proxy error:', error);
    // SECURITY: Don't expose internal error details to clients
    return new Response(
      JSON.stringify({ error: 'Erro ao processar webhook' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
