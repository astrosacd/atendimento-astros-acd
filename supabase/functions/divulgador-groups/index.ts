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

    const body = await req.json();
    const { action, instanceId, campaignId, groupName, groupDescription, participants, groupId, whatsappGroupId, numbers } = body;
    console.log(`[divulgador-groups] Action: ${action}, Campaign: ${campaignId}, GroupId: ${groupId}, InstanceId: ${instanceId}`);

    // Debug: list instances (helps identify mismatched flags)
    const { data: allInstances, error: allInstancesError } = await supabase
      .from('divulgador_instances')
      .select('id, instance_name, is_active, is_connected, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('[divulgador-groups] Instances snapshot:', JSON.stringify({ allInstances, allInstancesError }));

    const getInstanceById = async (id: string) => {
      const { data, error } = await supabase
        .from('divulgador_instances')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    };

    // Server-side test connection (avoids CORS/mixed-content in browser)
    if (action === 'test-connection') {
      if (!instanceId) {
        return new Response(JSON.stringify({ error: 'instanceId é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instance = await getInstanceById(instanceId);
      const { api_url, api_key, instance_name } = instance;

      const url = `${api_url}/instance/connectionState/${instance_name}`;
      const res = await fetch(url, { headers: { apikey: api_key } });
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        const text = await res.text();
        return new Response(JSON.stringify({
          ok: false,
          state: null,
          error: 'API retornou conteúdo não-JSON',
          preview: text.substring(0, 200),
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const json = await res.json().catch(() => ({}));
      const state = json?.instance?.state || json?.state || null;

      return new Response(JSON.stringify({ ok: res.ok, state, raw: json }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side webhook configuration (avoids CORS/mixed-content in browser)
    if (action === 'configure-webhook') {
      if (!instanceId) {
        return new Response(JSON.stringify({ error: 'instanceId é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instance = await getInstanceById(instanceId);
      const { api_url, api_key, instance_name } = instance;
      const webhookUrl = `${supabaseUrl}/functions/v1/divulgador-welcome`;

      const res = await fetch(`${api_url}/webhook/set/${instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: api_key,
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: true,
          webhook_base64: false,
          events: ['GROUP_PARTICIPANTS_UPDATE', 'GROUPS_UPSERT'],
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await res.json().catch(() => ({}))
        : { text: (await res.text()).substring(0, 200) };

      return new Response(JSON.stringify({
        success: res.ok,
        status: res.status,
        data: payload,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pick an instance managed by the panel
    // Prefer active+connected; fallback to active; fallback to any (so we can return a better error)
    const pickInstance = async () => {
      const { data: activeConnected } = await supabase
        .from('divulgador_instances')
        .select('*')
        .eq('is_active', true)
        .eq('is_connected', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeConnected) return activeConnected;

      const { data: activeAny } = await supabase
        .from('divulgador_instances')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeAny) return activeAny;

      const { data: anyInst } = await supabase
        .from('divulgador_instances')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return anyInst;
    };

    const instance = await pickInstance();

    if (!instance) {
      console.error('[divulgador-groups] No WhatsApp instance found in divulgador_instances');
      return new Response(JSON.stringify({ error: 'Nenhuma instância encontrada. Crie uma instância no painel (aba WhatsApp).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!instance.is_active) {
      return new Response(JSON.stringify({ error: 'Existe instância cadastrada, mas está desativada. Ative o switch "Ativo" no painel.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!instance.is_connected) {
      return new Response(JSON.stringify({ error: 'Existe instância ativa, mas não conectada. Clique em testar/conectar (ícone de atualizar) no painel.' }), {
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
      const linkResponse = await fetch(`${api_url}/group/inviteCode/${instance_name}?groupJid=${groupId}`, {
        headers: { 'apikey': api_key },
      });

      const linkData = await linkResponse.json();
      
      return new Response(JSON.stringify({ inviteLink: linkData.inviteLink || linkData.code }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'add-participants') {
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

      const fetchedGroups = await fetchResponse.json();
      console.log(`[divulgador-groups] Fetched ${fetchedGroups.length || 0} groups from WhatsApp`);
      
      // Get all WhatsApp group IDs from the fetched data
      const whatsappGroupIds = new Set(
        fetchedGroups.map((g: any) => g.id || g.jid).filter(Boolean)
      );
      
      // Get all existing groups from database
      const { data: existingGroups } = await supabase
        .from('divulgador_groups')
        .select('id, whatsapp_group_id');
      
      // Delete groups that no longer exist in WhatsApp
      let deletedCount = 0;
      if (existingGroups && existingGroups.length > 0) {
        for (const existingGroup of existingGroups) {
          if (!whatsappGroupIds.has(existingGroup.whatsapp_group_id)) {
            // Delete participants first
            await supabase
              .from('divulgador_participants')
              .delete()
              .eq('group_id', existingGroup.id);
            
            // Delete welcome configs
            await supabase
              .from('divulgador_welcome_config')
              .delete()
              .eq('group_id', existingGroup.id);
            
            // Delete the group
            await supabase
              .from('divulgador_groups')
              .delete()
              .eq('id', existingGroup.id);
            
            deletedCount++;
            console.log(`[divulgador-groups] Deleted group ${existingGroup.whatsapp_group_id} - no longer exists in WhatsApp`);
          }
        }
      }
      
      // Save/update groups in database
      const savedGroups = [];
      for (const group of fetchedGroups) {
        const groupId = group.id || group.jid;
        const groupName = group.subject || group.name || 'Sem nome';
        const participantCount = group.participants?.length || group.size || 0;
        
        // Check if group already exists
        const { data: existing } = await supabase
          .from('divulgador_groups')
          .select('id')
          .eq('whatsapp_group_id', groupId)
          .maybeSingle();
        
        if (existing) {
          // Update existing group
          const { data: updated } = await supabase
            .from('divulgador_groups')
            .update({
              name: groupName,
              participant_count: participantCount,
              invite_link: group.inviteCode ? `https://chat.whatsapp.com/${group.inviteCode}` : null,
            })
            .eq('id', existing.id)
            .select()
            .single();
          savedGroups.push(updated);
        } else {
          // Insert new group
          const { data: inserted } = await supabase
            .from('divulgador_groups')
            .insert({
              whatsapp_group_id: groupId,
              name: groupName,
              participant_count: participantCount,
              invite_link: group.inviteCode ? `https://chat.whatsapp.com/${group.inviteCode}` : null,
              is_active: true,
            })
            .select()
            .single();
          savedGroups.push(inserted);
        }
      }
      
      console.log(`[divulgador-groups] Saved/updated ${savedGroups.length} groups, deleted ${deletedCount}`);
      
      return new Response(JSON.stringify({ groups: fetchedGroups, saved: savedGroups.length, deleted: deletedCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync-participants') {
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
