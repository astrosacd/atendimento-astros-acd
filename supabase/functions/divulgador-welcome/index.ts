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

    const payload = await req.json();
    console.log('[divulgador-welcome] Received payload:', JSON.stringify(payload));

    // Evolution API sends different event formats
    // GROUP_PARTICIPANTS_UPDATE event format
    let participantNumber: string | undefined;
    let groupJid: string | undefined;
    let participantName: string | undefined;
    let action: string | undefined;

    // Handle Evolution API GROUP_PARTICIPANTS_UPDATE event
    if (payload.event === 'GROUP_PARTICIPANTS_UPDATE' || payload.event === 'group-participants.update') {
      const data = payload.data || payload;
      groupJid = data.groupJid || data.id || data.remoteJid;
      
      // Evolution sends participants array
      const participants = data.participants || [];
      action = data.action;

      // Only process 'add' actions (new participants)
      if (action !== 'add') {
        console.log('[divulgador-welcome] Ignoring non-add action:', action);
        return new Response(JSON.stringify({ success: true, ignored: true, action }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!groupJid) {
        return new Response(JSON.stringify({ error: 'Group JID not found in payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Process each participant
      const results = [];
      for (const participant of participants) {
        const number = typeof participant === 'string' ? participant : participant.id || participant;
        const result = await processParticipant(supabase, number, groupJid, participantName);
        results.push(result);
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle direct call format (manual trigger or legacy)
    participantNumber = payload.participantNumber || payload.participant;
    groupJid = payload.groupJid || payload.groupId || payload.remoteJid;
    participantName = payload.participantName || payload.name;

    if (!participantNumber || !groupJid) {
      return new Response(JSON.stringify({ error: 'Dados insuficientes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await processParticipant(supabase, participantNumber, groupJid, participantName);
    
    return new Response(JSON.stringify(result), {
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

async function processParticipant(
  supabase: any,
  participantNumber: string,
  groupJid: string,
  participantName?: string
) {
  console.log(`[divulgador-welcome] Processing participant: ${participantNumber} in group: ${groupJid}`);

  // Get WhatsApp instance config
  const { data: instance, error: instanceError } = await supabase
    .from('divulgador_whatsapp_instance')
    .select('*')
    .limit(1)
    .single();

  if (instanceError || !instance) {
    console.error('[divulgador-welcome] No WhatsApp instance configured');
    return { error: 'Instância não configurada' };
  }

  const { api_url, api_key, instance_name } = instance;

  // Clean group JID (remove @g.us if present)
  const cleanGroupJid = groupJid.includes('@') ? groupJid : `${groupJid}@g.us`;

  // Find the group in our database
  const { data: group } = await supabase
    .from('divulgador_groups')
    .select('*, divulgador_campaigns(id)')
    .or(`whatsapp_group_id.eq.${cleanGroupJid},whatsapp_group_id.eq.${groupJid}`)
    .single();

  if (!group) {
    console.log('[divulgador-welcome] Group not found in database:', groupJid);
    return { error: 'Grupo não encontrado', groupJid };
  }

  // Clean participant number
  const cleanNumber = participantNumber
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace(/\D/g, '');

  // Check if participant already exists and welcome was sent
  const { data: existingParticipant } = await supabase
    .from('divulgador_participants')
    .select('id, welcome_sent')
    .eq('group_id', group.id)
    .eq('whatsapp_number', cleanNumber)
    .single();

  if (existingParticipant?.welcome_sent) {
    console.log('[divulgador-welcome] Welcome already sent to:', cleanNumber);
    return { success: true, alreadySent: true, participant: cleanNumber };
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
  try {
    await supabase.rpc('increment_participant_count', { p_group_id: group.id });
  } catch (e) {
    console.log('[divulgador-welcome] Could not increment count:', e);
  }

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
    return { success: true, noWelcomeConfig: true, participant: cleanNumber };
  }

  const welcomeConfig = welcomeConfigs[0];
  
  // Apply delay if configured
  if (welcomeConfig.delay_seconds > 0) {
    console.log(`[divulgador-welcome] Waiting ${welcomeConfig.delay_seconds}s before sending...`);
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

    console.log('[divulgador-welcome] Welcome sent successfully to:', cleanNumber);
    return { success: true, participant: cleanNumber, group: group.name };
  } else {
    console.error('[divulgador-welcome] Failed to send welcome:', sendData);
    return { success: false, error: sendData, participant: cleanNumber };
  }
}
