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

    // Get webhook status from Evolution API
    if (action === 'get-webhook-status') {
      if (!instanceId) {
        return new Response(JSON.stringify({ error: 'instanceId é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const instance = await getInstanceById(instanceId);
      const { api_url, api_key, instance_name } = instance;
      const expectedWebhookUrl = `${supabaseUrl}/functions/v1/divulgador-welcome`;

      console.log(`[divulgador-groups] Checking webhook status for ${instance_name}`);
      console.log(`[divulgador-groups] API URL: ${api_url}/webhook/find/${instance_name}`);

      const res = await fetch(`${api_url}/webhook/find/${instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': api_key,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[divulgador-groups] Webhook find response status: ${res.status}`);
      
      const contentType = res.headers.get('content-type') || '';
      let payload: any = null;
      
      if (contentType.includes('application/json')) {
        payload = await res.json().catch((e) => {
          console.log(`[divulgador-groups] Error parsing JSON:`, e);
          return null;
        });
      } else {
        const text = await res.text();
        console.log(`[divulgador-groups] Non-JSON response:`, text.substring(0, 500));
        payload = { text: text.substring(0, 200) };
      }

      console.log(`[divulgador-groups] Webhook status raw response:`, JSON.stringify(payload));

      // Evolution API v2 returns different structures, handle all cases
      // Could be: { url, events, ... } or { webhook: { ... } } or array of webhooks
      let webhookData = payload;
      
      // Handle array response (some versions return array)
      if (Array.isArray(payload)) {
        webhookData = payload.length > 0 ? payload[0] : null;
        console.log(`[divulgador-groups] Response is array, using first item`);
      }
      
      // Handle nested webhook object
      if (webhookData?.webhook) {
        webhookData = webhookData.webhook;
      }

      const webhookUrl = webhookData?.url || webhookData?.webhookUrl || null;
      const events = webhookData?.events || [];
      const isConfigured = webhookUrl && webhookUrl.includes('divulgador-welcome');
      const hasGroupEvent = Array.isArray(events) && events.includes('GROUP_PARTICIPANTS_UPDATE');

      console.log(`[divulgador-groups] Parsed: url=${webhookUrl}, events=${JSON.stringify(events)}, isConfigured=${isConfigured}`);

      return new Response(JSON.stringify({
        success: res.ok,
        status: res.status,
        isConfigured: !!isConfigured,
        hasGroupEvent,
        currentUrl: webhookUrl,
        expectedUrl: expectedWebhookUrl,
        events,
        raw: payload,
      }), {
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

      console.log(`[divulgador-groups] Configuring webhook for ${instance_name} -> ${webhookUrl}`);

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

      console.log(`[divulgador-groups] Webhook configure response:`, JSON.stringify(payload));

      return new Response(JSON.stringify({
        success: res.ok,
        status: res.status,
        webhookUrl,
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

      // Get instance phone numbers for admin checking using multiple methods
      const instancePhoneNumbers: Record<string, string> = {};
      for (const inst of connectedInstances) {
        try {
          // Method 1: Try connectionState which often has the owner number
          const connStateRes = await fetch(`${inst.api_url}/instance/connectionState/${inst.instance_name}`, {
            headers: { 'apikey': inst.api_key },
          });
          if (connStateRes.ok) {
            const connData = await connStateRes.json();
            const ownerJid = connData?.instance?.wuid || connData?.instance?.ownerJid || connData?.wuid;
            if (ownerJid) {
              instancePhoneNumbers[inst.id] = ownerJid.replace('@s.whatsapp.net', '').replace(':*', '');
              console.log(`[divulgador-groups] Instance ${inst.instance_name} phone from connectionState: ${instancePhoneNumbers[inst.id]}`);
            }
          }

          // Method 2: If still no phone, try fetchInstances
          if (!instancePhoneNumbers[inst.id]) {
            const profileRes = await fetch(`${inst.api_url}/instance/fetchInstances`, {
              headers: { 'apikey': inst.api_key },
            });
            if (profileRes.ok) {
              const instancesList = await profileRes.json();
              const thisInstance = instancesList?.find((i: any) => 
                i.name === inst.instance_name || 
                i.instance?.instanceName === inst.instance_name ||
                i.instanceName === inst.instance_name
              );
              const ownerJid = thisInstance?.ownerJid || thisInstance?.instance?.ownerJid || 
                              thisInstance?.owner || thisInstance?.instance?.owner ||
                              thisInstance?.number || thisInstance?.instance?.number;
              if (ownerJid) {
                instancePhoneNumbers[inst.id] = String(ownerJid).replace('@s.whatsapp.net', '').replace(':*', '');
                console.log(`[divulgador-groups] Instance ${inst.instance_name} phone from fetchInstances: ${instancePhoneNumbers[inst.id]}`);
              }
            }
          }
        } catch (e) {
          console.log(`[divulgador-groups] Could not get phone for ${inst.instance_name}:`, e);
        }
      }

      console.log(`[divulgador-groups] Instance phone numbers:`, JSON.stringify(instancePhoneNumbers));

      // Collect all groups from all instances
      const allFetchedGroups: any[] = [];
      const instanceGroupMap: Record<string, string> = {}; // whatsapp_group_id -> instance_id

      for (const inst of connectedInstances) {
        try {
          console.log(`[divulgador-groups] Fetching from instance: ${inst.instance_name}`);
          // Use getParticipants=true to get participants in single call
          const fetchResponse = await fetch(`${inst.api_url}/group/fetchAllGroups/${inst.instance_name}?getParticipants=true`, {
            headers: { 'apikey': inst.api_key },
          });

          if (!fetchResponse.ok) {
            console.log(`[divulgador-groups] Instance ${inst.instance_name} returned ${fetchResponse.status}`);
            continue;
          }

          const fetchedGroups = await fetchResponse.json();
          console.log(`[divulgador-groups] Instance ${inst.instance_name}: ${fetchedGroups?.length || 0} groups`);

          const instancePhone = instancePhoneNumbers[inst.id];
          const cleanInstancePhone = instancePhone ? instancePhone.replace(/\D/g, '') : '';

          for (const g of (fetchedGroups || [])) {
            const gId = g.id || g.jid;
            if (gId) {
              // Avoid duplicates
              if (!instanceGroupMap[gId]) {
                instanceGroupMap[gId] = inst.id;
                
                // Check if instance is admin of this group
                let isInstanceAdmin = false;
                
                // Try to find admin status from participants if available
                const participants = g.participants || [];
                if (cleanInstancePhone && participants.length > 0) {
                  for (const p of participants) {
                    const pNumber = (p.id || p.jid || '').replace('@s.whatsapp.net', '').replace(':*', '').replace(/\D/g, '');
                    
                    if (pNumber && cleanInstancePhone && 
                        (pNumber === cleanInstancePhone || pNumber.endsWith(cleanInstancePhone) || cleanInstancePhone.endsWith(pNumber))) {
                      const adminStatus = p.admin || p.isAdmin || p.role;
                      isInstanceAdmin = adminStatus === 'admin' || adminStatus === 'superadmin' || adminStatus === true || p.isSuperAdmin === true;
                      console.log(`[divulgador-groups] Group ${g.subject}: Phone ${pNumber} admin=${adminStatus} isAdmin=${isInstanceAdmin}`);
                      break;
                    }
                  }
                }
                
                // Fallback: check if instance owns the group
                if (!isInstanceAdmin && cleanInstancePhone) {
                  const ownerNumber = (g.owner || g.subjectOwner || '').replace('@s.whatsapp.net', '').replace(':*', '').replace(/\D/g, '');
                  if (ownerNumber && (ownerNumber === cleanInstancePhone || ownerNumber.endsWith(cleanInstancePhone) || cleanInstancePhone.endsWith(ownerNumber))) {
                    isInstanceAdmin = true;
                    console.log(`[divulgador-groups] Group ${g.subject}: Instance is owner`);
                  }
                }
                
                allFetchedGroups.push({ ...g, _instanceId: inst.id, _isInstanceAdmin: isInstanceAdmin });
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
        const isInstanceAdmin = group._isInstanceAdmin || false;
        
        // Extract permissions from WhatsApp group metadata
        const announce = group.announce || false;
        const restrict = group.restrict || false;
        const memberAddMode = group.memberAddMode || false;

        // Check if group already exists
        const { data: existing } = await supabase
          .from('divulgador_groups')
          .select('id')
          .eq('whatsapp_group_id', groupId)
          .maybeSingle();

        if (existing) {
          // Update existing group with permissions and admin status
          const { data: updated } = await supabase
            .from('divulgador_groups')
            .update({
              name: groupName,
              participant_count: participantCount,
              invite_link: group.inviteCode ? `https://chat.whatsapp.com/${group.inviteCode}` : null,
              instance_id: instanceId,
              announce,
              restrict,
              member_add_mode: memberAddMode,
              is_instance_admin: isInstanceAdmin,
            })
            .eq('id', existing.id)
            .select()
            .single();
          savedGroups.push(updated);
        } else {
          // Insert new group with permissions and admin status
          const { data: inserted } = await supabase
            .from('divulgador_groups')
            .insert({
              whatsapp_group_id: groupId,
              name: groupName,
              participant_count: participantCount,
              invite_link: group.inviteCode ? `https://chat.whatsapp.com/${group.inviteCode}` : null,
              is_active: true,
              instance_id: instanceId,
              announce,
              restrict,
              member_add_mode: memberAddMode,
              is_instance_admin: isInstanceAdmin,
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
          await fetch(`${api_url}/group/updateSetting/${instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': api_key,
            },
            body: JSON.stringify({ groupJid: createdGroupId, action: 'announcement' }),
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
          
          // Detect if it's a community - communities have isCommunity flag or specific structure
          // Also detect by checking if it's a community announcement group or linked community
          const isCommunity = Boolean(
            targetGroup.isCommunity || 
            targetGroup.linkedParent || // linked to a parent community
            targetGroup.isParentGroup || // is a parent community group
            (wid && wid.includes('@newsletter')) || // newsletter/channel
            (targetGroup.announce && !targetGroup.pictureUrl && !targetGroup.desc) // likely community if announce-only with no info
          );
          
          console.log('[divulgador-groups] Is community:', isCommunity, 'wid:', wid);
          
          return new Response(JSON.stringify({ 
            success: true, 
            isCommunity,
            settings: {
              announce: targetGroup.announce || false, // admin only messages
              restrict: targetGroup.restrict || false, // locked (admin only edit info)
              memberAddMode: targetGroup.memberAddMode || false, // approval mode
              subject: targetGroup.subject,
              desc: targetGroup.desc,
              pictureUrl: targetGroup.pictureUrl || null, // group photo URL
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Group not found in WhatsApp - might be a community or deleted
        console.log('[divulgador-groups] Group not found in WhatsApp groups list, might be a community');
        return new Response(JSON.stringify({ 
          success: false, 
          isCommunity: true, // Assume community if not found in regular groups list
          error: 'Grupo não encontrado na lista de grupos. Pode ser uma comunidade que não pode ser editada.' 
        }), {
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
      const apiResponses: any[] = [];

      // Helper to make API call and collect response for debug
      const makeApiCall = async (endpoint: string, method: string, body: any, label: string) => {
        const res = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            apikey: api_key,
          },
          body: JSON.stringify(body),
        });
        const resData = await res.json().catch(() => ({}));
        const result = { label, ok: res.ok, status: res.status, data: resData, method, endpoint };
        console.log(`[divulgador-groups] ${label} response:`, JSON.stringify(result));
        apiResponses.push(result);
        return { ok: res.ok, data: resData };
      };

      // Update group name if provided - Evolution API v2: POST with groupJid in body
      if (groupName !== undefined) {
        try {
          console.log(`[divulgador-groups] Updating group name to: ${groupName}`);
          const result = await makeApiCall(
            `${api_url}/group/updateGroupSubject/${instance_name}`,
            'POST',
            { groupJid: wid, subject: groupName },
            'Atualizar Nome'
          );
          if (result.ok) nameUpdated = true;
        } catch (e) {
          console.error('[divulgador-groups] Failed to update name:', e);
          apiResponses.push({ label: 'Atualizar Nome', ok: false, error: String(e) });
        }
      }

      // Update group description if provided - Evolution API v2: POST with groupJid in body
      if (groupDescription !== undefined) {
        try {
          await makeApiCall(
            `${api_url}/group/updateGroupDescription/${instance_name}`,
            'POST',
            { groupJid: wid, description: groupDescription },
            'Atualizar Descrição'
          );
        } catch (e) {
          console.error('[divulgador-groups] Failed to update description:', e);
          apiResponses.push({ label: 'Atualizar Descrição', ok: false, error: String(e) });
        }
      }

      // Update group photo if provided - Evolution API v2: POST with groupJid in body
      if (groupPhoto) {
        try {
          await makeApiCall(
            `${api_url}/group/updateGroupPicture/${instance_name}`,
            'POST',
            { groupJid: wid, image: groupPhoto },
            'Atualizar Foto'
          );
        } catch (e) {
          console.error('[divulgador-groups] Failed to update photo:', e);
          apiResponses.push({ label: 'Atualizar Foto', ok: false, error: String(e) });
        }
      }

      // Update admin-only setting (announcement mode) if provided
      // Evolution API: updateSetting expects groupJid + action in body (method varies by version)
      if (adminOnly !== undefined) {
        try {
          const settingAction = adminOnly ? 'announcement' : 'not_announcement';
          await makeApiCall(
            `${api_url}/group/updateSetting/${instance_name}`,
            'POST',
            { groupJid: wid, action: settingAction },
            'Permissão Envio'
          );
        } catch (e) {
          console.error('[divulgador-groups] Failed to update announcement settings:', e);
          apiResponses.push({ label: 'Permissão Envio', ok: false, error: String(e) });
        }
      }

      // Update locked setting (only admins can edit group info) if provided
      if (locked !== undefined) {
        try {
          const settingAction = locked ? 'locked' : 'unlocked';
          await makeApiCall(
            `${api_url}/group/updateSetting/${instance_name}`,
            'POST',
            { groupJid: wid, action: settingAction },
            'Permissão Edição'
          );
        } catch (e) {
          console.error('[divulgador-groups] Failed to update locked settings:', e);
          apiResponses.push({ label: 'Permissão Edição', ok: false, error: String(e) });
        }
      }

      // Member add permission (who can add new members) if provided
      // NOTE: The updateSetting endpoint documented for this API version only supports:
      // announcement, not_announcement, locked, unlocked
      // So we don't attempt to change "memberAddMode" here.
      if (approvalMode !== undefined) {
        apiResponses.push({
          label: 'Adicionar membros',
          ok: false,
          status: 400,
          data: {
            status: 400,
            error: 'Bad Request',
            response: {
              message: [
                {
                  property: 'action',
                  message: 'Alterar "Adicionar membros" não é suportado nesta versão (actions suportadas: announcement, not_announcement, locked, unlocked).',
                },
              ],
            },
          },
        });
      }

      // Update database record including permissions
      const updatePayload: any = {};
      if (groupName) updatePayload.name = groupName;
      if (groupDescription !== undefined) updatePayload.description = groupDescription;
      // Always persist permission state to database
      if (adminOnly !== undefined) updatePayload.announce = adminOnly;
      if (locked !== undefined) updatePayload.restrict = locked;
      // approvalMode is not supported by the API version (kept as-is from sync/get settings)

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('divulgador_groups')
          .update(updatePayload)
          .eq('id', groupId);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        nameUpdated, 
        apiResponses,
        instance: instance_name,
        groupJid: wid
      }), {
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
