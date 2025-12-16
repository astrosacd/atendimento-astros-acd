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

    console.log('[divulgador-monitor] Starting group monitoring');

    // Get WhatsApp instance config
    const { data: instance, error: instanceError } = await supabase
      .from('divulgador_whatsapp_instance')
      .select('*')
      .limit(1)
      .single();

    if (instanceError || !instance) {
      console.error('[divulgador-monitor] No WhatsApp instance configured');
      return new Response(JSON.stringify({ error: 'Instância não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { api_url, api_key, instance_name } = instance;

    // Get all active campaigns with auto_create_groups enabled
    const { data: campaigns } = await supabase
      .from('divulgador_campaigns')
      .select('*')
      .eq('is_active', true)
      .eq('auto_create_groups', true);

    if (!campaigns || campaigns.length === 0) {
      console.log('[divulgador-monitor] No campaigns with auto-create enabled');
      return new Response(JSON.stringify({ success: true, message: 'Nenhuma campanha para monitorar' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const campaign of campaigns) {
      console.log(`[divulgador-monitor] Checking campaign: ${campaign.name}`);

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
            const createResponse = await fetch(`${api_url}/group/create/${instance_name}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': api_key,
              },
              body: JSON.stringify({
                subject: groupName,
                description: campaign.description || `Grupo da campanha ${campaign.name}`,
                participants: [],
              }),
            });

            const createData = await createResponse.json();
            console.log(`[divulgador-monitor] Created group: ${groupName}`, createData);

            if (createResponse.ok && (createData.id || createData.groupId)) {
              // Save to database
              await supabase.from('divulgador_groups').insert({
                campaign_id: campaign.id,
                whatsapp_group_id: createData.id || createData.groupId,
                name: groupName,
                description: campaign.description,
                invite_link: createData.inviteLink || null,
                participant_count: 0,
                is_active: true,
              });

              results.push({
                campaign: campaign.name,
                group: groupName,
                status: 'created',
              });
            } else {
              results.push({
                campaign: campaign.name,
                group: groupName,
                status: 'error',
                error: createData.message || 'Falha ao criar grupo',
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
        
        // Update groups to mark as almost full (optional status)
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

      // Sync participant counts from WhatsApp
      for (const group of groups || []) {
        try {
          const participantsResponse = await fetch(
            `${api_url}/group/participants/${instance_name}?groupJid=${group.whatsapp_group_id}`,
            { headers: { 'apikey': api_key } }
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

    return new Response(JSON.stringify({ success: true, results }), {
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
