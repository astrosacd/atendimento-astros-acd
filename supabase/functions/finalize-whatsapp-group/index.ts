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
    let currentParticipants: string[] = [];
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
      
      // Extract participant JIDs (exclude the bot's own number)
      if (Array.isArray(groupInfo)) {
        currentParticipants = groupInfo.map((p: any) => p.id || p.jid || p).filter((p: string) => typeof p === 'string');
      } else if (groupInfo?.participants) {
        currentParticipants = groupInfo.participants.map((p: any) => p.id || p.jid || p).filter((p: string) => typeof p === 'string');
      }
    } catch (e) {
      console.error('Error fetching group participants:', e);
      // Fallback to stored participants
      currentParticipants = (group.participants || []).map((p: string) => {
        const clean = p.replace(/\D/g, '');
        return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`;
      });
    }

    console.log('Participants to mention:', currentParticipants);

    // Step 2: Send farewell message mentioning all participants
    const mentionPayload = {
      number: group.group_jid,
      text: message,
      mentions: {
        everyOne: true,
      },
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

    for (const participant of currentParticipants) {
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
        removeResults.push({ participant, success: removeRes.ok });
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
