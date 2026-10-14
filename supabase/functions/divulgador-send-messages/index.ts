import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // Get WhatsApp instance from divulgador_instances (active and connected)
    const { data: instance, error: instanceError } = await supabase
      .from('divulgador_instances')
      .select('*')
      .eq('is_active', true)
      .eq('is_connected', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (instanceError) {
      console.error('[divulgador-send-messages] Error fetching instance:', instanceError);
    }

    if (!instance) {
      console.error('[divulgador-send-messages] No active/connected WhatsApp instance found');
      return new Response(JSON.stringify({ error: 'Nenhuma instância WhatsApp ativa e conectada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { api_url, api_key, instance_name } = instance;
    console.log(`[divulgador-send-messages] Using instance: ${instance_name}`);

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

      // Get target groups - check both group_id (single group) and campaign_id (legacy)
      let groupsQuery = supabase.from('divulgador_groups').select('*').eq('is_active', true);
      
      if (message.group_id) {
        // Single specific group
        groupsQuery = groupsQuery.eq('id', message.group_id);
      } else if (message.campaign_id) {
        // Legacy: filter by campaign
        groupsQuery = groupsQuery.eq('campaign_id', message.campaign_id);
      }
      // If neither, send to all active groups

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
      
      // Get delay from message config (default 2 seconds, minimum 1 second)
      const delayMs = Math.max((message.delay_seconds || 2) * 1000, 1000);
      console.log(`[divulgador-send-messages] Using delay of ${delayMs}ms between groups`);

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        
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
          } else if (message.media_type === 'poll') {
            // Send poll/enquete
            endpoint = `${api_url}/message/sendPoll/${instance_name}`;
            const pollOptions = message.poll_options || [];
            body = {
              number: group.whatsapp_group_id,
              name: message.content, // Poll question/title
              selectableCount: message.poll_selectable_count || 1,
              values: pollOptions,
              mentionsEveryOne: message.mention_all || false,
            };
            console.log(`[divulgador-send-messages] Sending poll with ${pollOptions.length} options`);
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

          // Some Evolution setups require the "mentioned" field for @everyone/ghost-mention to work.
          if (message.mention_all) {
            body.mentioned = [group.whatsapp_group_id];
          }

          console.log(`[divulgador-send-messages] Sending to group ${group.name} (${i + 1}/${groups.length})`);

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

          // Apply delay between sends (skip delay after last group)
          if (i < groups.length - 1) {
            console.log(`[divulgador-send-messages] Waiting ${delayMs}ms before next group...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }

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