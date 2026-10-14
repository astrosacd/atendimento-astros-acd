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

    const payload = await req.json();
    console.log('[divulgador-welcome] Received payload:', JSON.stringify(payload));

    // Evolution API sends different event formats
    let participantNumber: string | undefined;
    let groupJid: string | undefined;
    let participantName: string | undefined;
    let action: string | undefined;

    // Handle Evolution API GROUP_PARTICIPANTS_UPDATE event
    if (payload.event === 'GROUP_PARTICIPANTS_UPDATE' || payload.event === 'group-participants.update') {
      const data = payload.data || payload;
      groupJid = data.groupJid || data.id || data.remoteJid;
      
      const participants = data.participants || [];
      action = data.action;

      // Handle 'add' (join) and 'remove' (leave) actions
      if (action !== 'add' && action !== 'remove') {
        console.log('[divulgador-welcome] Ignoring non-add/non-remove action:', action);
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
        // Evolution may send either a string JID or an object with id/phoneNumber
        const raw = typeof participant === 'string'
          ? participant
          : (participant.phoneNumber || participant.id || (participant as any).jid || participant);

        const number = typeof raw === 'string' ? raw : (raw?.phoneNumber || raw?.id || String(raw));

        // Prefer push name / notify if available (common in Evolution payloads)
        const name = typeof participant === 'object'
          ? ((participant as any).pushName || (participant as any).notify || (participant as any).profileName || (participant as any).name)
          : undefined;

        const messageType = action === 'add' ? 'join' : 'leave';
        const result = await processParticipant(supabase, number, groupJid, name, messageType);
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

    const result = await processParticipant(supabase, participantNumber, groupJid, participantName, 'join');
    
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
  participantName?: string,
  messageType: 'join' | 'leave' = 'join'
) {
  console.log(`[divulgador-welcome] Processing ${messageType} for participant: ${participantNumber} in group: ${groupJid}`);

  // Clean group JID (remove @g.us if present)
  const cleanGroupJid = groupJid.includes('@') ? groupJid : `${groupJid}@g.us`;
  const groupJidWithoutSuffix = cleanGroupJid.replace('@g.us', '');

  // Find the group in our database
  const { data: group } = await supabase
    .from('divulgador_groups')
    .select('*, divulgador_campaigns(id, instance_id)')
    .or(`whatsapp_group_id.eq.${cleanGroupJid},whatsapp_group_id.eq.${groupJidWithoutSuffix}`)
    .single();

  if (!group) {
    console.log('[divulgador-welcome] Group not found in database:', groupJid);
    return { error: 'Grupo não encontrado', groupJid };
  }

  // Get WhatsApp instance config
  // Priority:
  // 1) the instance that owns the group (group.instance_id)
  // 2) campaign's instance_id (if group belongs to a campaign)
  // 3) any active + connected instance
  let instance;

  if (group.instance_id) {
    const { data: groupInstance } = await supabase
      .from('divulgador_instances')
      .select('*')
      .eq('id', group.instance_id)
      .eq('is_active', true)
      .single();
    instance = groupInstance;
  }

  if (!instance && group.divulgador_campaigns?.instance_id) {
    const { data: campaignInstance } = await supabase
      .from('divulgador_instances')
      .select('*')
      .eq('id', group.divulgador_campaigns.instance_id)
      .eq('is_active', true)
      .single();
    instance = campaignInstance;
  }

  if (!instance) {
    // Fallback to first active instance
    const { data: activeInstance } = await supabase
      .from('divulgador_instances')
      .select('*')
      .eq('is_active', true)
      .eq('is_connected', true)
      .limit(1)
      .single();
    instance = activeInstance;
  }

  if (!instance) {
    console.error('[divulgador-welcome] No WhatsApp instance configured');
    return { error: 'Instância não configurada' };
  }

  const { api_url, api_key, instance_name } = instance;

  // Clean participant number
  const cleanNumber = participantNumber
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace('@lid', '')
    .replace(/\D/g, '');

  // Fetch WhatsApp profile name if not provided
  let finalName = participantName;
  if (!finalName || finalName === 'Participante') {
    const jidNumber = `${cleanNumber}@s.whatsapp.net`;

    try {
      console.log(`[divulgador-welcome] Fetching profile for ${jidNumber}...`);

      const profileRes = await fetch(`${api_url}/chat/fetchProfile/${instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': api_key,
        },
        body: JSON.stringify({ number: jidNumber }),
      });

      console.log(`[divulgador-welcome] fetchProfile status: ${profileRes.status}`);

      const rawText = await profileRes.text();
      let profileData: any = null;
      try {
        profileData = rawText ? JSON.parse(rawText) : null;
      } catch {
        profileData = null;
      }

      // Evolution API returns name in different fields depending on version/instance
      let fetchedName =
        profileData?.name ||
        profileData?.pushName ||
        profileData?.verifiedName ||
        profileData?.profileName ||
        profileData?.notify ||
        profileData?.profile?.pushName ||
        profileData?.profile?.notify ||
        null;

      if (!fetchedName) {
        // Fallback: Find Contacts tends to return pushName/notify when available
        try {
          const findRes = await fetch(`${api_url}/chat/findContacts/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ where: { id: jidNumber } }),
          });

          console.log(`[divulgador-welcome] findContacts status: ${findRes.status}`);
          const findText = await findRes.text();
          let findData: any = null;
          try {
            findData = findText ? JSON.parse(findText) : null;
          } catch {
            findData = null;
          }

          // Some versions return array, others return { data: [...] }
          const contact = Array.isArray(findData) ? findData[0] : (findData?.data?.[0] ?? findData?.data ?? findData);
          fetchedName =
            contact?.pushName ||
            contact?.notify ||
            contact?.name ||
            contact?.profileName ||
            null;

          if (!fetchedName) {
            console.log(`[divulgador-welcome] findContacts returned no name fields. Body: ${findText?.slice(0, 500)}`);
          }
        } catch (e) {
          console.log('[divulgador-welcome] findContacts failed:', e);
        }
      }

      if (fetchedName) {
        finalName = fetchedName;
        console.log(`[divulgador-welcome] Got profile name: ${finalName}`);
      } else {
        console.log(`[divulgador-welcome] Profile fetched but no name fields found. Body: ${rawText?.slice(0, 500)}`);
      }
    } catch (e) {
      console.log(`[divulgador-welcome] Could not fetch profile:`, e);
    }
  }

  // Handle LEAVE event
  if (messageType === 'leave') {
    // Update participant left_at timestamp
    await supabase
      .from('divulgador_participants')
      .update({ left_at: new Date().toISOString(), welcome_sent: false })
      .eq('group_id', group.id)
      .eq('whatsapp_number', cleanNumber);

    // Find exit message config for this group
    let exitQuery = supabase
      .from('divulgador_welcome_config')
      .select('*')
      .eq('is_active', true)
      .eq('message_type', 'leave');

    exitQuery = exitQuery.or(`group_id.eq.${group.id},group_id.is.null`);
    const { data: exitConfigs } = await exitQuery.order('group_id', { ascending: false, nullsFirst: false });

    if (!exitConfigs || exitConfigs.length === 0) {
      console.log('[divulgador-welcome] No exit message configured');
      return { success: true, noExitConfig: true, participant: cleanNumber };
    }

    const exitConfig = exitConfigs[0];

    // Apply delay if configured
    if (exitConfig.delay_seconds > 0) {
      console.log(`[divulgador-welcome] Waiting ${exitConfig.delay_seconds}s before sending exit message...`);
      await new Promise(resolve => setTimeout(resolve, exitConfig.delay_seconds * 1000));
    }

    // Replace placeholders in message
    let exitMessage = exitConfig.message
      .replace(/{nome}/gi, finalName || 'Participante')
      .replace(/{numero}/gi, cleanNumber)
      .replace(/{grupo}/gi, group.name);

    console.log(`[divulgador-welcome] Sending exit message to ${cleanNumber} via ${instance_name}`);

    // Send private message
    const sendResponse = await fetch(`${api_url}/message/sendText/${instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': api_key,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: exitMessage,
      }),
    });

    const sendData = await sendResponse.json();

    if (sendResponse.ok) {
      console.log('[divulgador-welcome] Exit message sent successfully to:', cleanNumber);
      return { success: true, type: 'leave', participant: cleanNumber, group: group.name, instance: instance_name };
    } else {
      console.error('[divulgador-welcome] Failed to send exit message:', sendData);
      return { success: false, type: 'leave', error: sendData, participant: cleanNumber };
    }
  }

  // Handle JOIN event (original logic)
  // Check if participant already exists and welcome was sent
  const { data: existingParticipant } = await supabase
    .from('divulgador_participants')
    .select('id, welcome_sent, left_at')
    .eq('group_id', group.id)
    .eq('whatsapp_number', cleanNumber)
    .single();

  // If the participant never left and we already sent a welcome, don't spam
  if (existingParticipant?.welcome_sent && !existingParticipant?.left_at) {
    console.log('[divulgador-welcome] Welcome already sent to:', cleanNumber);
    return { success: true, alreadySent: true, participant: cleanNumber };
  }

  // Insert or update participant
  await supabase
    .from('divulgador_participants')
    .upsert({
      group_id: group.id,
      whatsapp_number: cleanNumber,
      name: finalName || null,
      joined_at: new Date().toISOString(),
      welcome_sent: false,
      left_at: null, // Clear left_at if rejoining
    }, { onConflict: 'group_id,whatsapp_number' });

  // Update group participant count
  try {
    await supabase.rpc('increment_participant_count', { p_group_id: group.id });
  } catch (e) {
    console.log('[divulgador-welcome] Could not increment count:', e);
  }

  // Get welcome message config - now uses group_id and message_type
  let welcomeQuery = supabase
    .from('divulgador_welcome_config')
    .select('*')
    .eq('is_active', true)
    .eq('message_type', 'join');

  // First try to find group-specific welcome message
  welcomeQuery = welcomeQuery.or(`group_id.eq.${group.id},group_id.is.null`);

  const { data: welcomeConfigs } = await welcomeQuery.order('group_id', { ascending: false, nullsFirst: false });

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
    .replace(/{nome}/gi, finalName || 'Participante')
    .replace(/{numero}/gi, cleanNumber)
    .replace(/{grupo}/gi, group.name);

  console.log(`[divulgador-welcome] Sending welcome to ${cleanNumber} via ${instance_name}`);

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
    return { success: true, type: 'join', participant: cleanNumber, group: group.name, instance: instance_name };
  } else {
    console.error('[divulgador-welcome] Failed to send welcome:', sendData);
    return { success: false, type: 'join', error: sendData, participant: cleanNumber };
  }
}
