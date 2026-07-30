import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-temp-access-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Não autorizado');

    const body = await req.json();
    const { groupId, reason, message, instanceApiUrl, instanceApiKey, instanceName, delaySeconds } = body;

    if (!groupId || !reason || !message) {
      throw new Error('ID do grupo, motivo e mensagem são obrigatórios');
    }

    if (!instanceApiUrl || !instanceApiKey || !instanceName) {
      throw new Error('Configuração da instância WhatsApp é obrigatória');
    }

    // Get group info
    const { data: group, error: groupError } = await supabase
      .from('client_whatsapp_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) throw new Error('Grupo não encontrado');
    if (!group.group_jid) throw new Error('JID do grupo não encontrado. O grupo pode não ter sido criado corretamente.');

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', user.id)
      .single();

    const delay = Math.max(1, Math.min(30, delaySeconds || 3)) * 1000;

    // Step 1: Get current group participants from Evolution API
    let participantsForRemoval: string[] = [];
    try {
      const groupInfoRes = await fetch(
        `${instanceApiUrl}/group/participants/${instanceName}?groupJid=${encodeURIComponent(group.group_jid)}`,
        {
          method: 'GET',
          headers: { 'apikey': instanceApiKey },
        }
      );
      const groupInfo = await groupInfoRes.json();
      console.log('Group participants response:', JSON.stringify(groupInfo));
      
      // Extract participant phone numbers in @s.whatsapp.net format for removal
      // The API returns participants with @lid IDs but also phoneNumber field
      const participants = Array.isArray(groupInfo) ? groupInfo : (groupInfo?.participants || []);
      
      for (const p of participants) {
        // Prefer phoneNumber field (format: 55xxxx@s.whatsapp.net)
        if (p.phoneNumber && typeof p.phoneNumber === 'string') {
          participantsForRemoval.push(p.phoneNumber);
        } else if (p.id && typeof p.id === 'string' && p.id.includes('@s.whatsapp.net')) {
          participantsForRemoval.push(p.id);
        }
      }
      
      // Filter out the bot/admin (superadmin) to avoid removing itself
      const adminParticipants = participants
        .filter((p: any) => p.admin === 'superadmin')
        .map((p: any) => p.phoneNumber || p.id);
      
      participantsForRemoval = participantsForRemoval.filter(
        p => !adminParticipants.includes(p)
      );
      
    } catch (e) {
      console.error('Error fetching group participants:', e);
      // Fallback to stored participants
      participantsForRemoval = (group.participants || []).map((p: string) => {
        const clean = p.replace(/\D/g, '');
        return `${clean}@s.whatsapp.net`;
      });
    }

    console.log('Participants to remove:', participantsForRemoval);

    // Step 2: Send farewell message mentioning all participants (same pattern as divulgador)
    const mentionPayload = {
      number: group.group_jid,
      text: message,
      mentionsEveryOne: true,
      mentioned: [group.group_jid],
    };

    console.log('Sending farewell message:', JSON.stringify(mentionPayload));

    const sendRes = await fetch(
      `${instanceApiUrl}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instanceApiKey,
        },
        body: JSON.stringify(mentionPayload),
      }
    );

    const sendData = await sendRes.json();
    console.log('Send message response:', JSON.stringify(sendData));

    if (!sendRes.ok) {
      console.error('Failed to send farewell message:', sendData);
    }

    // Step 3: Wait initial delay then remove participants one by one
    const removeResults: { participant: string; success: boolean; error?: string }[] = [];

    for (const participant of participantsForRemoval) {
      // Wait the configured delay between each removal
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const removeRes = await fetch(
          `${instanceApiUrl}/group/updateParticipant/${instanceName}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'apikey': instanceApiKey,
            },
            body: JSON.stringify({
              groupJid: group.group_jid,
              action: 'remove',
              participants: [participant],
            }),
          }
        );

        const removeData = await removeRes.json();
        console.log(`Remove ${participant}:`, JSON.stringify(removeData));
        
        // If PUT fails, try POST as fallback
        if (!removeRes.ok) {
          console.log(`PUT failed for ${participant}, trying POST...`);
          const removeRes2 = await fetch(
            `${instanceApiUrl}/group/updateParticipant/${instanceName}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': instanceApiKey,
              },
              body: JSON.stringify({
                groupJid: group.group_jid,
                action: 'remove',
                participants: [participant],
              }),
            }
          );
          const removeData2 = await removeRes2.json();
          console.log(`POST Remove ${participant}:`, JSON.stringify(removeData2));
          removeResults.push({ participant, success: removeRes2.ok });
        } else {
          removeResults.push({ participant, success: true });
        }
      } catch (e: any) {
        console.error(`Error removing ${participant}:`, e);
        removeResults.push({ participant, success: false, error: e.message });
      }
    }

    // Step 4: Update group record
    await supabase
      .from('client_whatsapp_groups')
      .update({
        status: 'finalized',
        finalized_at: new Date().toISOString(),
        finalized_by: user.id,
        finalized_by_email: profile?.email || user.email,
        finalized_by_name: profile?.name || user.email,
        finalization_reason: reason,
        finalization_message: message,
      })
      .eq('id', groupId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Projeto finalizado com sucesso!',
      removeResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error finalizing WhatsApp group:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
