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

    // This can be called via webhook from Evolution API when a participant joins
    const payload = await req.json();
    console.log('[divulgador-welcome] Received payload:', JSON.stringify(payload));

    const { participantNumber, groupId, groupJid, participantName } = payload;

    if (!participantNumber || !groupJid) {
      return new Response(JSON.stringify({ error: 'Dados insuficientes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get WhatsApp instance config
    const { data: instance, error: instanceError } = await supabase
      .from('divulgador_whatsapp_instance')
      .select('*')
      .limit(1)
      .single();

    if (instanceError || !instance) {
      console.error('[divulgador-welcome] No WhatsApp instance configured');
      return new Response(JSON.stringify({ error: 'Instância não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { api_url, api_key, instance_name } = instance;

    // Find the group in our database
    const { data: group } = await supabase
      .from('divulgador_groups')
      .select('*, divulgador_campaigns(id)')
      .eq('whatsapp_group_id', groupJid)
      .single();

    if (!group) {
      console.log('[divulgador-welcome] Group not found in database:', groupJid);
      return new Response(JSON.stringify({ error: 'Grupo não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Register participant in database
    const cleanNumber = participantNumber.replace('@s.whatsapp.net', '').replace('@c.us', '');
    
    const { data: existingParticipant } = await supabase
      .from('divulgador_participants')
      .select('id, welcome_sent')
      .eq('group_id', group.id)
      .eq('whatsapp_number', cleanNumber)
      .single();

    if (existingParticipant?.welcome_sent) {
      console.log('[divulgador-welcome] Welcome already sent to:', cleanNumber);
      return new Response(JSON.stringify({ success: true, alreadySent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert or update participant
    await supabase
      .from('divulgador_participants')
      .upsert({
        group_id: group.id,
        whatsapp_number: cleanNumber,
        name: participantName || null,
        joined_at: new Date().toISOString(),
        welcome_sent: false,
      }, { onConflict: 'group_id,whatsapp_number' });

    // Update group participant count
    await supabase.rpc('increment_participant_count', { group_id: group.id });

    // Get welcome message config
    let welcomeQuery = supabase
      .from('divulgador_welcome_config')
      .select('*')
      .eq('is_active', true);

    if (group.campaign_id) {
      welcomeQuery = welcomeQuery.or(`campaign_id.eq.${group.campaign_id},campaign_id.is.null`);
    } else {
      welcomeQuery = welcomeQuery.is('campaign_id', null);
    }

    const { data: welcomeConfigs } = await welcomeQuery.order('campaign_id', { ascending: false, nullsFirst: false });

    if (!welcomeConfigs || welcomeConfigs.length === 0) {
      console.log('[divulgador-welcome] No welcome message configured');
      return new Response(JSON.stringify({ success: true, noWelcomeConfig: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const welcomeConfig = welcomeConfigs[0];
    
    // Apply delay if configured
    if (welcomeConfig.delay_seconds > 0) {
      await new Promise(resolve => setTimeout(resolve, welcomeConfig.delay_seconds * 1000));
    }

    // Replace placeholders in message
    let welcomeMessage = welcomeConfig.message
      .replace(/{nome}/gi, participantName || 'Participante')
      .replace(/{numero}/gi, cleanNumber)
      .replace(/{grupo}/gi, group.name);

    console.log(`[divulgador-welcome] Sending welcome to ${cleanNumber}`);

    // Send private message
    const sendResponse = await fetch(`${api_url}/message/sendText/${instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_key,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: welcomeMessage,
      }),
    });

    const sendData = await sendResponse.json();

    if (sendResponse.ok) {
      // Mark welcome as sent
      await supabase
        .from('divulgador_participants')
        .update({ welcome_sent: true })
        .eq('group_id', group.id)
        .eq('whatsapp_number', cleanNumber);

      console.log('[divulgador-welcome] Welcome sent successfully');
    } else {
      console.error('[divulgador-welcome] Failed to send welcome:', sendData);
    }

    return new Response(JSON.stringify({ 
      success: sendResponse.ok, 
      participant: cleanNumber,
      group: group.name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[divulgador-welcome] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
