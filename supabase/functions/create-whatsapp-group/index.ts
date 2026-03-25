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
    const { clienteId, groupName, groupDescription, participants, imageBase64, motivo, instanceApiUrl, instanceApiKey, instanceName } = body;

    if (!groupName || !participants || participants.length === 0) {
      throw new Error('Nome do grupo e pelo menos um participante são obrigatórios');
    }

    // Use instance passed from frontend, or fallback to env vars
    const evolutionApiUrl = instanceApiUrl || Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = instanceApiKey || Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = instanceName || Deno.env.get('EVOLUTION_INSTANCE');

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      throw new Error('Configuração da Evolution API não encontrada. Selecione uma instância ou configure as variáveis de ambiente.');
    }

    // Get user profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', user.id)
      .single();

    // Format participants - ensure they have @s.whatsapp.net
    const formattedParticipants = participants.map((p: string) => {
      const clean = p.replace(/\D/g, '');
      return clean.includes('@') ? clean : `${clean}@s.whatsapp.net`;
    });

    // Step 1: Create the group via Evolution API
    const createGroupUrl = `${evolutionApiUrl}/group/create/${evolutionInstance}`;
    console.log('Creating group at:', createGroupUrl);

    const createResponse = await fetch(createGroupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        subject: groupName,
        description: groupDescription || '',
        participants: formattedParticipants,
      }),
    });

    const createData = await createResponse.json();
    console.log('Create group response:', JSON.stringify(createData));

    if (!createResponse.ok) {
      throw new Error(`Erro ao criar grupo: ${JSON.stringify(createData)}`);
    }

    const groupJid = createData?.id || createData?.groupJid || createData?.jid || null;

    // Step 2: Set group description if provided and groupJid exists
    if (groupDescription && groupJid) {
      try {
        await fetch(`${evolutionApiUrl}/group/updateDescription/${evolutionInstance}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            groupJid,
            description: groupDescription,
          }),
        });
      } catch (e) {
        console.error('Error setting group description:', e);
      }
    }

    // Step 3: Set group image if provided
    if (imageBase64 && groupJid) {
      try {
        // Clean base64: remove data URL prefix if present and any whitespace
        let cleanImage = imageBase64.trim();
        if (cleanImage.includes(',') && cleanImage.startsWith('data:')) {
          cleanImage = cleanImage.split(',')[1];
        }
        cleanImage = cleanImage.replace(/\s/g, '');

        console.log('Setting group image, base64 length:', cleanImage.length);

        await fetch(`${evolutionApiUrl}/group/updateGroupPicture/${evolutionInstance}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            groupJid,
            image: cleanImage,
          }),
        });
      } catch (e) {
        console.error('Error setting group image:', e);
      }
    }

    // Step 4: Log the group creation
    await supabase.from('client_whatsapp_groups').insert({
      cliente_id: clienteId || null,
      group_name: groupName,
      group_description: groupDescription || null,
      group_jid: groupJid,
      participants: participants,
      created_by: user.id,
      created_by_email: profile?.email || user.email,
      created_by_name: profile?.name || user.email,
      motivo: motivo || null,
      status: 'created',
    });

    return new Response(JSON.stringify({ 
      success: true, 
      groupJid,
      message: 'Grupo criado com sucesso!' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error creating WhatsApp group:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
