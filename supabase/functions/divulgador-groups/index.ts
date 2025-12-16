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

    const { action, campaignId, groupName, groupDescription, participants } = await req.json();
    console.log(`[divulgador-groups] Action: ${action}, Campaign: ${campaignId}`);

    // Get WhatsApp instance config
    const { data: instance, error: instanceError } = await supabase
      .from('divulgador_whatsapp_instance')
      .select('*')
      .limit(1)
      .single();

    if (instanceError || !instance) {
      console.error('[divulgador-groups] No WhatsApp instance configured');
      return new Response(JSON.stringify({ error: 'Instância WhatsApp não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { api_url, api_key, instance_name } = instance;

    if (action === 'create') {
      // Create group via Evolution API
      console.log(`[divulgador-groups] Creating group: ${groupName}`);
      
      const createResponse = await fetch(`${api_url}/group/create/${instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': api_key,
        },
        body: JSON.stringify({
          subject: groupName,
          description: groupDescription || '',
          participants: participants || [],
        }),
      });

      const createData = await createResponse.json();
      console.log('[divulgador-groups] Create response:', JSON.stringify(createData));

      if (!createResponse.ok) {
        throw new Error(createData.message || 'Erro ao criar grupo');
      }

      // Save group to database
      const { data: savedGroup, error: saveError } = await supabase
        .from('divulgador_groups')
        .insert({
          campaign_id: campaignId || null,
          whatsapp_group_id: createData.id || createData.groupId,
          name: groupName,
          description: groupDescription,
          invite_link: createData.inviteLink || null,
          participant_count: participants?.length || 0,
          is_active: true,
        })
        .select()
        .single();

      if (saveError) {
        console.error('[divulgador-groups] Save error:', saveError);
        throw saveError;
      }

      return new Response(JSON.stringify({ success: true, group: savedGroup, whatsappData: createData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-invite-link') {
      const { groupId } = await req.json();
      
      const linkResponse = await fetch(`${api_url}/group/inviteCode/${instance_name}?groupJid=${groupId}`, {
        headers: { 'apikey': api_key },
      });

      const linkData = await linkResponse.json();
      
      return new Response(JSON.stringify({ inviteLink: linkData.inviteLink || linkData.code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'add-participants') {
      const { groupId, numbers } = await req.json();
      
      const addResponse = await fetch(`${api_url}/group/updateParticipant/${instance_name}?groupJid=${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': api_key,
        },
        body: JSON.stringify({
          action: 'add',
          participants: numbers.map((n: string) => n.includes('@') ? n : `${n}@s.whatsapp.net`),
        }),
      });

      const addData = await addResponse.json();
      
      return new Response(JSON.stringify({ success: true, data: addData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'remove-participants') {
      const { groupId, numbers } = await req.json();
      
      const removeResponse = await fetch(`${api_url}/group/updateParticipant/${instance_name}?groupJid=${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': api_key,
        },
        body: JSON.stringify({
          action: 'remove',
          participants: numbers.map((n: string) => n.includes('@') ? n : `${n}@s.whatsapp.net`),
        }),
      });

      const removeData = await removeResponse.json();
      
      return new Response(JSON.stringify({ success: true, data: removeData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'fetch-groups') {
      // Fetch all groups from WhatsApp
      const fetchResponse = await fetch(`${api_url}/group/fetchAllGroups/${instance_name}?getParticipants=true`, {
        headers: { 'apikey': api_key },
      });

      const groups = await fetchResponse.json();
      console.log(`[divulgador-groups] Fetched ${groups.length || 0} groups from WhatsApp`);
      
      return new Response(JSON.stringify({ groups }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync-participants') {
      const { groupId, whatsappGroupId } = await req.json();
      
      // Get participants from WhatsApp
      const participantsResponse = await fetch(`${api_url}/group/participants/${instance_name}?groupJid=${whatsappGroupId}`, {
        headers: { 'apikey': api_key },
      });

      const participantsData = await participantsResponse.json();
      const participants_list = participantsData.participants || [];
      
      // Update participant count in database
      await supabase
        .from('divulgador_groups')
        .update({ participant_count: participants_list.length })
        .eq('id', groupId);

      // Sync participants to database
      for (const p of participants_list) {
        const number = p.id?.replace('@s.whatsapp.net', '') || p.number;
        
        await supabase
          .from('divulgador_participants')
          .upsert({
            group_id: groupId,
            whatsapp_number: number,
            name: p.name || p.pushName || null,
            is_admin: p.admin === 'admin' || p.admin === 'superadmin',
          }, { onConflict: 'group_id,whatsapp_number' });
      }
      
      return new Response(JSON.stringify({ success: true, count: participants_list.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[divulgador-groups] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
