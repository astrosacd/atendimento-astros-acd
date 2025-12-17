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
    const { 
      action, instanceId, campaignId, groupName, groupDescription, participants, 
      groupId, whatsappGroupId, numbers, groupPhoto, adminOnly, locked, approvalMode 
    } = body;
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

    // Get ALL active and connected instances for operations that need multiple instances
    const getAllActiveConnectedInstances = async () => {
      const { data } = await supabase
        .from('divulgador_instances')
        .select('*')
        .eq('is_active', true)
        .eq('is_connected', true)
        .order('created_at', { ascending: false });
      return data || [];
    };

    // Pick a single instance (for single-instance operations like create group)
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

    // ========== FETCH-GROUPS: Sync from ALL connected instances ==========
    if (action === 'fetch-groups') {
      const connectedInstances = await getAllActiveConnectedInstances();
      
      if (connectedInstances.length === 0) {
        return new Response(JSON.stringify({ error: 'Nenhuma instância WhatsApp ativa e conectada. Conecte ao menos uma instância.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[divulgador-groups] Fetching groups from ${connectedInstances.length} instance(s)`);

      // Collect all groups from all instances
      const allFetchedGroups: any[] = [];
      const instanceGroupMap: Record<string, string> = {}; // whatsapp_group_id -> instance_id

      for (const inst of connectedInstances) {
        try {
          console.log(`[divulgador-groups] Fetching from instance: ${inst.instance_name}`);
          const fetchResponse = await fetch(`${inst.api_url}/group/fetchAllGroups/${inst.instance_name}?getParticipants=true`, {
            headers: { 'apikey': inst.api_key },
          });

          if (!fetchResponse.ok) {
            console.log(`[divulgador-groups] Instance ${inst.instance_name} returned ${fetchResponse.status}`);
            continue;
          }

          const fetchedGroups = await fetchResponse.json();
          console.log(`[divulgador-groups] Instance ${inst.instance_name}: ${fetchedGroups?.length || 0} groups`);

          for (const g of (fetchedGroups || [])) {
            const gId = g.id || g.jid;
            if (gId) {
              // Avoid duplicates (same group might appear in multiple instances if shared)
              if (!instanceGroupMap[gId]) {
                instanceGroupMap[gId] = inst.id;
                allFetchedGroups.push({ ...g, _instanceId: inst.id });
              }
            }
          }
        } catch (err) {
          console.error(`[divulgador-groups] Error fetching from ${inst.instance_name}:`, err);
        }
      }

      console.log(`[divulgador-groups] Total unique groups fetched: ${allFetchedGroups.length}`);

      // Get all WhatsApp group IDs from the fetched data
      const whatsappGroupIds = new Set(
        allFetchedGroups.map((g: any) => g.id || g.jid).filter(Boolean)
      );

      // Get all existing groups from database
      const { data: existingGroups } = await supabase
        .from('divulgador_groups')
        .select('id, whatsapp_group_id');

      // Delete groups that no longer exist in any WhatsApp instance
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
            console.log(`[divulgador-groups] Deleted group ${existingGroup.whatsapp_group_id} - no longer exists`);
          }
        }
      }

      // Save/update groups in database
      const savedGroups = [];
      for (const group of allFetchedGroups) {
        const groupId = group.id || group.jid;
        const groupName = group.subject || group.name || 'Sem nome';
        const participantCount = group.participants?.length || group.size || 0;
        const instanceId = group._instanceId;

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
              instance_id: instanceId,
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
              instance_id: instanceId,
            })
            .select()
            .single();
          savedGroups.push(inserted);
        }
      }

      console.log(`[divulgador-groups] Saved/updated ${savedGroups.length} groups, deleted ${deletedCount}`);

      return new Response(JSON.stringify({ groups: allFetchedGroups, saved: savedGroups.length, deleted: deletedCount, instancesUsed: connectedInstances.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== SYNC-PARTICIPANTS: Use the instance linked to the group ==========
    if (action === 'sync-participants') {
      // Try to get the group's instance_id first
      let instance;
      
      if (groupId) {
        const { data: groupData } = await supabase
          .from('divulgador_groups')
          .select('instance_id')
          .eq('id', groupId)
          .single();
        
        if (groupData?.instance_id) {
          const { data: groupInstance } = await supabase
            .from('divulgador_instances')
            .select('*')
            .eq('id', groupData.instance_id)
            .eq('is_active', true)
            .eq('is_connected', true)
            .single();
          instance = groupInstance;
        }
      }
      
      // Fallback to any connected instance
      if (!instance) {
        instance = await pickInstance();
      }

      if (!instance) {
        return new Response(JSON.stringify({ error: 'Nenhuma instância WhatsApp ativa e conectada' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { api_url, api_key, instance_name } = instance;

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

    // ========== CREATE GROUP: Requires specific instance selection ==========
    if (action === 'create') {
      // Require instanceId for create action - no default
      if (!instanceId) {
        return new Response(JSON.stringify({ error: 'Selecione uma instância WhatsApp para criar o grupo' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instance = await getInstanceById(instanceId);
      
      if (!instance.is_active) {
        return new Response(JSON.stringify({ error: 'A instância selecionada está desativada. Ative-a no painel.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!instance.is_connected) {
        return new Response(JSON.stringify({ error: 'A instância selecionada não está conectada. Teste a conexão primeiro.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { api_url, api_key, instance_name } = instance;

      // Create group via Evolution API
      console.log(`[divulgador-groups] Creating group: ${groupName} on instance ${instance_name} with participants:`, participants);
      
      const createPayload: any = {
        subject: groupName,
        description: groupDescription || '',
        participants: participants || [],
      };
      
      console.log('[divulgador-groups] Create payload:', JSON.stringify(createPayload));
      
      const createResponse = await fetch(`${api_url}/group/create/${instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': api_key,
        },
        body: JSON.stringify(createPayload),
      });

      const createData = await createResponse.json();
      console.log('[divulgador-groups] Create response status:', createResponse.status);
      console.log('[divulgador-groups] Create response:', JSON.stringify(createData));

      if (!createResponse.ok) {
        const errorMsg = createData.message || createData.error || JSON.stringify(createData);
        
        if (errorMsg.includes('participant') || errorMsg.includes('number') || (!participants || participants.length === 0)) {
          console.error('[divulgador-groups] Group creation failed - may need participants');
          return new Response(JSON.stringify({ 
            error: 'Para criar um grupo via API, adicione pelo menos 1 participante (número WhatsApp). Você pode sincronizar grupos existentes do WhatsApp ao invés de criar novos.' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error(errorMsg);
      }

      const createdGroupId = createData.id || createData.groupId;

      // Set group photo if provided
      if (groupPhoto && createdGroupId) {
        try {
          await fetch(`${api_url}/group/updateGroupPicture/${instance_name}?groupJid=${createdGroupId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ image: groupPhoto }),
          });
          console.log('[divulgador-groups] Group photo set successfully');
        } catch (photoError) {
          console.error('[divulgador-groups] Failed to set group photo:', photoError);
        }
      }

      // Set admin-only messages if requested
      if (adminOnly && createdGroupId) {
        try {
          await fetch(`${api_url}/group/updateSetting/${instance_name}?groupJid=${createdGroupId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ action: 'announcement' }),
          });
          console.log('[divulgador-groups] Admin-only mode enabled');
        } catch (settingError) {
          console.error('[divulgador-groups] Failed to set admin-only:', settingError);
        }
      }

      // Save group to database
      const { data: savedGroup, error: saveError } = await supabase
        .from('divulgador_groups')
        .insert({
          campaign_id: campaignId || null,
          whatsapp_group_id: createdGroupId,
          name: groupName,
          description: groupDescription,
          invite_link: createData.inviteLink || null,
          participant_count: participants?.length || 0,
          is_active: true,
          instance_id: instance.id,
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

    // ========== GET GROUP SETTINGS: Fetch current permissions from WhatsApp ==========
    if (action === 'get-group-settings') {
      if (!groupId) {
        return new Response(JSON.stringify({ error: 'groupId é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get group from database to find the instance
      const { data: groupData, error: groupError } = await supabase
        .from('divulgador_groups')
        .select('*, divulgador_instances(*)')
        .eq('id', groupId)
        .single();

      if (groupError || !groupData) {
        return new Response(JSON.stringify({ error: 'Grupo não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instance = groupData.divulgador_instances;
      if (!instance) {
        return new Response(JSON.stringify({ error: 'Instância do grupo não encontrada' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { api_url, api_key, instance_name } = instance;
      const wid = groupData.whatsapp_group_id;

      try {
        // Fetch group metadata from WhatsApp
        const res = await fetch(`${api_url}/group/fetchAllGroups/${instance_name}?getParticipants=false`, {
          headers: { 'apikey': api_key },
        });
        
        const allGroups = await res.json();
        const targetGroup = allGroups?.find((g: any) => (g.id || g.jid) === wid);
        
        if (targetGroup) {
          console.log('[divulgador-groups] Group settings fetched:', JSON.stringify(targetGroup));
          return new Response(JSON.stringify({ 
            success: true, 
            settings: {
              announce: targetGroup.announce || false, // admin only messages
              restrict: targetGroup.restrict || false, // locked (admin only edit info)
              memberAddMode: targetGroup.memberAddMode || false, // approval mode
              subject: targetGroup.subject,
              desc: targetGroup.desc,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ success: false, error: 'Grupo não encontrado no WhatsApp' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('[divulgador-groups] Failed to fetch group settings:', e);
        return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar configurações' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========== UPDATE GROUP: Edit name, description, photo, settings ==========
    if (action === 'update-group') {
      if (!groupId) {
        return new Response(JSON.stringify({ error: 'groupId é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get group from database to find the instance
      const { data: groupData, error: groupError } = await supabase
        .from('divulgador_groups')
        .select('*, divulgador_instances(*)')
        .eq('id', groupId)
        .single();

      if (groupError || !groupData) {
        return new Response(JSON.stringify({ error: 'Grupo não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instance = groupData.divulgador_instances;
      if (!instance) {
        return new Response(JSON.stringify({ error: 'Instância do grupo não encontrada' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { api_url, api_key, instance_name } = instance;
      const wid = groupData.whatsapp_group_id;

      let nameUpdated = false;

      // Update group name if provided (always try to update)
      if (groupName) {
        try {
          console.log(`[divulgador-groups] Updating group name to: ${groupName}`);
          const res = await fetch(`${api_url}/group/updateSubject/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ groupJid: wid, subject: groupName }),
          });
          const resData = await res.json().catch(() => ({}));
          console.log('[divulgador-groups] Group name update response:', JSON.stringify({ ok: res.ok, status: res.status, data: resData }));
          if (res.ok) nameUpdated = true;
        } catch (e) {
          console.error('[divulgador-groups] Failed to update name:', e);
        }
      }

      // Update group description if provided
      if (groupDescription !== undefined) {
        try {
          const res = await fetch(`${api_url}/group/updateDescription/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ groupJid: wid, description: groupDescription }),
          });
          const resData = await res.json().catch(() => ({}));
          console.log('[divulgador-groups] Group description update response:', JSON.stringify({ ok: res.ok, status: res.status, data: resData }));
        } catch (e) {
          console.error('[divulgador-groups] Failed to update description:', e);
        }
      }

      // Update group photo if provided
      if (groupPhoto) {
        try {
          const res = await fetch(`${api_url}/group/updateGroupPicture/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ groupJid: wid, image: groupPhoto }),
          });
          const resData = await res.json().catch(() => ({}));
          console.log('[divulgador-groups] Group photo update response:', JSON.stringify({ ok: res.ok, status: res.status, data: resData }));
        } catch (e) {
          console.error('[divulgador-groups] Failed to update photo:', e);
        }
      }

      // Update admin-only setting (announcement mode) if provided
      if (adminOnly !== undefined) {
        try {
          const settingAction = adminOnly ? 'announcement' : 'not_announcement';
          const res = await fetch(`${api_url}/group/updateSetting/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ groupJid: wid, action: settingAction }),
          });
          const resData = await res.json().catch(() => ({}));
          console.log('[divulgador-groups] Admin-only setting update response:', JSON.stringify({ ok: res.ok, status: res.status, data: resData }));
        } catch (e) {
          console.error('[divulgador-groups] Failed to update announcement settings:', e);
        }
      }

      // Update locked setting (only admins can edit group info) if provided
      if (locked !== undefined) {
        try {
          const settingAction = locked ? 'locked' : 'unlocked';
          const res = await fetch(`${api_url}/group/updateSetting/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ groupJid: wid, action: settingAction }),
          });
          const resData = await res.json().catch(() => ({}));
          console.log('[divulgador-groups] Locked setting update response:', JSON.stringify({ ok: res.ok, status: res.status, data: resData }));
        } catch (e) {
          console.error('[divulgador-groups] Failed to update locked settings:', e);
        }
      }

      // Update approval mode (membership approval required) if provided
      if (approvalMode !== undefined) {
        try {
          const settingAction = approvalMode ? 'membership_approval_request' : 'membership_approval_reject';
          const res = await fetch(`${api_url}/group/updateSetting/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ groupJid: wid, action: settingAction }),
          });
          const resData = await res.json().catch(() => ({}));
          console.log('[divulgador-groups] Approval mode update response:', JSON.stringify({ ok: res.ok, status: res.status, data: resData }));
        } catch (e) {
          console.error('[divulgador-groups] Failed to update approval mode:', e);
        }
      }

      // Update database record (always update if name was provided)
      const updatePayload: any = {};
      if (groupName) updatePayload.name = groupName;
      if (groupDescription !== undefined) updatePayload.description = groupDescription;

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('divulgador_groups')
          .update(updatePayload)
          .eq('id', groupId);
      }

      return new Response(JSON.stringify({ success: true, nameUpdated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== GET INVITE LINK ==========
    if (action === 'get-invite-link') {
      if (!groupId) {
        return new Response(JSON.stringify({ error: 'groupId é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get group from database to find the instance
      const { data: groupData, error: groupError } = await supabase
        .from('divulgador_groups')
        .select('*, divulgador_instances(*)')
        .eq('id', groupId)
        .single();

      if (groupError || !groupData) {
        return new Response(JSON.stringify({ error: 'Grupo não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instance = groupData.divulgador_instances;
      if (!instance) {
        return new Response(JSON.stringify({ error: 'Instância do grupo não encontrada' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { api_url, api_key, instance_name } = instance;
      const wid = groupData.whatsapp_group_id;

      const linkResponse = await fetch(`${api_url}/group/inviteCode/${instance_name}?groupJid=${wid}`, {
        headers: { 'apikey': api_key },
      });

      const linkData = await linkResponse.json();
      const inviteCode = linkData.inviteCode || linkData.code;
      const inviteLink = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : null;

      // Update database with the link
      if (inviteLink) {
        await supabase
          .from('divulgador_groups')
          .update({ invite_link: inviteLink })
          .eq('id', groupId);
      }

      return new Response(JSON.stringify({ inviteLink, code: inviteCode }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== Other actions require a single instance (legacy support) ==========
    const instance = instanceId ? await getInstanceById(instanceId) : await pickInstance();

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
