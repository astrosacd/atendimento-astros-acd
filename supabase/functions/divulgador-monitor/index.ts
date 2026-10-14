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

    console.log('[divulgador-monitor] Starting group monitoring');

    // Get ALL active and connected WhatsApp instances from correct table
    const { data: instances, error: instanceError } = await supabase
      .from('divulgador_instances')
      .select('*')
      .eq('is_active', true)
      .eq('is_connected', true);

    if (instanceError || !instances || instances.length === 0) {
      console.error('[divulgador-monitor] No active/connected WhatsApp instances');
      return new Response(JSON.stringify({ error: 'Nenhuma instância WhatsApp ativa e conectada. Configure pelo menos uma instância no painel.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[divulgador-monitor] Found ${instances.length} active instance(s)`);

    // Get all active campaigns with auto_create_groups enabled
    const { data: campaigns } = await supabase
      .from('divulgador_campaigns')
      .select('*')
      .eq('is_active', true)
      .eq('auto_create_groups', true);

    if (!campaigns || campaigns.length === 0) {
      console.log('[divulgador-monitor] No campaigns with auto-create enabled');
      return new Response(JSON.stringify({ success: true, message: 'Nenhuma campanha com auto-criar ativa' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const campaign of campaigns) {
      console.log(`[divulgador-monitor] Checking campaign: ${campaign.name}`);

      // Use campaign's assigned instance if available, otherwise pick first connected
      let instance = instances[0];
      if (campaign.instance_id) {
        const campaignInstance = instances.find(i => i.id === campaign.instance_id);
        if (campaignInstance) {
          instance = campaignInstance;
        }
      }

      const { api_url, api_key, instance_name } = instance;

      // Get groups for this campaign
      const { data: groups } = await supabase
        .from('divulgador_groups')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('is_active', true);

      // Count empty groups (groups with less than 10% of max capacity)
      const threshold = Math.floor(campaign.max_participants_per_group * 0.1);
      const emptyGroups = (groups || []).filter(g => g.participant_count < threshold);

      console.log(`[divulgador-monitor] Campaign ${campaign.name}: ${emptyGroups.length} empty groups (min required: ${campaign.min_empty_groups})`);

      // Check if we need to create more groups
      const groupsToCreate = campaign.min_empty_groups - emptyGroups.length;

      if (groupsToCreate > 0) {
        console.log(`[divulgador-monitor] Need to create ${groupsToCreate} new groups for ${campaign.name}`);

        for (let i = 0; i < groupsToCreate; i++) {
          const groupNumber = (groups?.length || 0) + i + 1;
          const groupName = `${campaign.name} #${groupNumber}`;

          try {
            // Create group via Evolution API
            // Note: Evolution API may require at least 1 participant, we try without first
            const createResponse = await fetch(`${api_url}/group/create/${instance_name}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': api_key,
              },
              body: JSON.stringify({
                subject: groupName,
                description: campaign.description || `Grupo da campanha ${campaign.name}`,
                participants: [], // Empty - some APIs allow this
              }),
            });

            const createData = await createResponse.json();
            console.log(`[divulgador-monitor] Created group: ${groupName}`, createData);

            if (createResponse.ok && (createData.id || createData.groupId)) {
              // Save to database with instance_id
              await supabase.from('divulgador_groups').insert({
                campaign_id: campaign.id,
                whatsapp_group_id: createData.id || createData.groupId,
                name: groupName,
                description: campaign.description,
                invite_link: createData.inviteLink || null,
                participant_count: 0,
                is_active: true,
                instance_id: instance.id,
              });

              results.push({
                campaign: campaign.name,
                group: groupName,
                status: 'created',
                instance: instance_name,
              });
            } else {
              results.push({
                campaign: campaign.name,
                group: groupName,
                status: 'error',
                error: createData.message || createData.error || 'Falha ao criar grupo',
              });
            }

            // Delay between creations
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (createError: unknown) {
            const errMsg = createError instanceof Error ? createError.message : 'Erro desconhecido';
            console.error(`[divulgador-monitor] Error creating group:`, errMsg);
            results.push({
              campaign: campaign.name,
              group: groupName,
              status: 'error',
              error: errMsg,
            });
          }
        }
      }

      // Check groups approaching limit and warn
      const almostFullGroups = (groups || []).filter(
        g => g.participant_count >= campaign.max_participants_per_group * 0.9
      );

      if (almostFullGroups.length > 0) {
        console.log(`[divulgador-monitor] ${almostFullGroups.length} groups approaching capacity in ${campaign.name}`);
        
        for (const group of almostFullGroups) {
          results.push({
            campaign: campaign.name,
            group: group.name,
            status: 'almost_full',
            participants: group.participant_count,
            max: campaign.max_participants_per_group,
          });
        }
      }

      // Sync participant counts from WhatsApp for all groups
      for (const group of groups || []) {
        try {
          // Use group's own instance if available
          let syncInstance = instance;
          if (group.instance_id) {
            const groupInstance = instances.find(i => i.id === group.instance_id);
            if (groupInstance) {
              syncInstance = groupInstance;
            }
          }

          const participantsResponse = await fetch(
            `${syncInstance.api_url}/group/participants/${syncInstance.instance_name}?groupJid=${group.whatsapp_group_id}`,
            { headers: { 'apikey': syncInstance.api_key } }
          );

          if (participantsResponse.ok) {
            const participantsData = await participantsResponse.json();
            const count = participantsData.participants?.length || 0;

            if (count !== group.participant_count) {
              await supabase
                .from('divulgador_groups')
                .update({ participant_count: count })
                .eq('id', group.id);

              console.log(`[divulgador-monitor] Updated participant count for ${group.name}: ${count}`);
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (syncError) {
          console.error(`[divulgador-monitor] Error syncing group ${group.name}:`, syncError);
        }
      }
    }

    console.log('[divulgador-monitor] Monitoring complete:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results, instancesUsed: instances.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[divulgador-monitor] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
