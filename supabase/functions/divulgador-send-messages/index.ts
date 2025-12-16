import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[divulgador-send-messages] Starting scheduled message processing');

    // Get WhatsApp instance config
    const { data: instance, error: instanceError } = await supabase
      .from('divulgador_whatsapp_instance')
      .select('*')
      .limit(1)
      .single();

    if (instanceError || !instance) {
      console.error('[divulgador-send-messages] No WhatsApp instance configured');
      return new Response(JSON.stringify({ error: 'Instância WhatsApp não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { api_url, api_key, instance_name } = instance;

    // Get pending messages that are scheduled for now or earlier
    const now = new Date().toISOString();
    const { data: pendingMessages, error: msgError } = await supabase
      .from('divulgador_messages')
      .select('*, divulgador_campaigns(id, name)')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    if (msgError) {
      console.error('[divulgador-send-messages] Error fetching messages:', msgError);
      throw msgError;
    }

    console.log(`[divulgador-send-messages] Found ${pendingMessages?.length || 0} pending messages`);

    const results = [];

    for (const message of pendingMessages || []) {
      console.log(`[divulgador-send-messages] Processing message ${message.id}`);

      // Mark as sending
      await supabase
        .from('divulgador_messages')
        .update({ status: 'sending' })
        .eq('id', message.id);

      // Get target groups
      let groupsQuery = supabase.from('divulgador_groups').select('*').eq('is_active', true);
      
      if (message.campaign_id) {
        groupsQuery = groupsQuery.eq('campaign_id', message.campaign_id);
      }

      const { data: groups } = await groupsQuery;

      if (!groups || groups.length === 0) {
        console.log(`[divulgador-send-messages] No groups found for message ${message.id}`);
        await supabase
          .from('divulgador_messages')
          .update({ status: 'failed' })
          .eq('id', message.id);
        continue;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const group of groups) {
        try {
          let endpoint = '';
          let body: any = {};

          if (message.media_type === 'text' || !message.media_type) {
            endpoint = `${api_url}/message/sendText/${instance_name}`;
            body = {
              number: group.whatsapp_group_id,
              text: message.content,
              mentionsEveryOne: message.mention_all || false,
            };
          } else if (message.media_type === 'image') {
            endpoint = `${api_url}/message/sendMedia/${instance_name}`;
            body = {
              number: group.whatsapp_group_id,
              mediatype: 'image',
              media: message.media_url,
              caption: message.content,
              mentionsEveryOne: message.mention_all || false,
            };
          } else if (message.media_type === 'video') {
            endpoint = `${api_url}/message/sendMedia/${instance_name}`;
            body = {
              number: group.whatsapp_group_id,
              mediatype: 'video',
              media: message.media_url,
              caption: message.content,
              mentionsEveryOne: message.mention_all || false,
            };
          } else if (message.media_type === 'audio') {
            endpoint = `${api_url}/message/sendWhatsAppAudio/${instance_name}`;
            body = {
              number: group.whatsapp_group_id,
              audio: message.media_url,
            };
          } else if (message.media_type === 'document') {
            endpoint = `${api_url}/message/sendMedia/${instance_name}`;
            body = {
              number: group.whatsapp_group_id,
              mediatype: 'document',
              media: message.media_url,
              caption: message.content,
            };
          }

          console.log(`[divulgador-send-messages] Sending to group ${group.name}`);

          const sendResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify(body),
          });

          const sendData = await sendResponse.json();

          // Log the send
          await supabase.from('divulgador_send_logs').insert({
            message_id: message.id,
            group_id: group.id,
            status: sendResponse.ok ? 'sent' : 'failed',
            error_message: sendResponse.ok ? null : (sendData.message || 'Erro desconhecido'),
          });

          if (sendResponse.ok) {
            successCount++;
          } else {
            errorCount++;
          }

          // Delay between sends to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (groupError: unknown) {
          const errMsg = groupError instanceof Error ? groupError.message : 'Erro desconhecido';
          console.error(`[divulgador-send-messages] Error sending to group ${group.id}:`, errMsg);
          errorCount++;
          
          await supabase.from('divulgador_send_logs').insert({
            message_id: message.id,
            group_id: group.id,
            status: 'failed',
            error_message: errMsg,
          });
        }
      }

      // Update message status
      const finalStatus = errorCount === groups.length ? 'failed' : 'sent';
      await supabase
        .from('divulgador_messages')
        .update({ 
          status: finalStatus,
          sent_at: new Date().toISOString(),
        })
        .eq('id', message.id);

      results.push({
        messageId: message.id,
        groups: groups.length,
        success: successCount,
        errors: errorCount,
      });
    }

    console.log('[divulgador-send-messages] Processing complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[divulgador-send-messages] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
