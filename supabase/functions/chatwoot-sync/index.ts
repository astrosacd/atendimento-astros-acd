import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get config
    const { data: config, error: configError } = await supabase
      .from('pipeline_chatwoot_config')
      .select('*')
      .maybeSingle();

    if (configError || !config || !config.enabled) {
      console.log("Integration disabled or not configured");
      return new Response(
        JSON.stringify({ error: "Integração Chatwoot desabilitada ou não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { chatwoot_url, chatwoot_api_key, account_id, inbox_id, sync_leads, sync_conversations } = config;

    if (!chatwoot_url || !chatwoot_api_key || !account_id) {
      console.log("Incomplete config:", { chatwoot_url, hasApiKey: !!chatwoot_api_key, account_id });
      return new Response(
        JSON.stringify({ error: "Configurações incompletas do Chatwoot" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get default stage
    const { data: defaultStage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('is_default', true)
      .maybeSingle();

    const baseUrl = `${chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${account_id}`;
    const headers = {
      "api_access_token": chatwoot_api_key,
      "Content-Type": "application/json"
    };

    let syncedCount = 0;

    // Logic updated to fetch open conversations instead of all contacts
    if (sync_leads || sync_conversations) {
      const statusList = ['open', 'pending'];
      let conversations: any[] = [];
      const openConvIds: number[] = [];

      for (const status of statusList) {
        let apiUrl = `${baseUrl}/conversations?status=${status}`;
        if (inbox_id) {
          apiUrl += `&inbox_id=${inbox_id}`;
        }
        
        console.log(`Fetching ${status} conversations from: ${apiUrl}`);
        const convsRes = await fetch(apiUrl, { headers });
        
        if (!convsRes.ok) {
          const errorText = await convsRes.text();
          console.error(`Chatwoot API error for ${status} (${convsRes.status}):`, errorText);
          continue;
        }
        
        const responseData = await convsRes.json();
        let rawConversations = [];
        
        if (Array.isArray(responseData)) {
          rawConversations = responseData;
        } else if (responseData.payload && Array.isArray(responseData.payload)) {
          rawConversations = responseData.payload;
        } else if (responseData.data) {
          if (Array.isArray(responseData.data)) {
            rawConversations = responseData.data;
          } else if (responseData.data.payload && Array.isArray(responseData.data.payload)) {
            rawConversations = responseData.data.payload;
          }
        }
        
        const currentConvs = rawConversations;
        
        console.log(`Found ${currentConvs.length} ${status} conversations`);
        conversations = [...conversations, ...currentConvs];
      }

      const allConvIds = conversations.map((c: any) => c.id);

      for (const conv of conversations) {
        const contact = conv.meta?.sender;
        if (!contact) continue;

        if (!contact.phone_number && !contact.email && !contact.name) {
          continue;
        }

        const cleanPhone = contact.phone_number ? contact.phone_number.replace(/\D/g, '') : null;
        
        let { data: existing, error: searchError } = await supabase
          .from('client_pipeline')
          .select('*')
          .eq('chatwoot_conversation_id', conv.id)
          .maybeSingle();

        if (searchError) {
          console.error(`Error searching by conversation ID (${conv.id}):`, searchError);
        }

        if (!existing) {
          let query = supabase.from('client_pipeline').select('*');
          const conditions = [];
          if (cleanPhone) conditions.push(`lead_phone.ilike.%${cleanPhone}%`);
          if (contact.email) conditions.push(`lead_email.eq.${contact.email}`);
          
          if (conditions.length > 0) {
            query = query.or(conditions.join(','));
            const { data: byContactInfo, error: searchContactError } = await query.maybeSingle();
            if (!searchContactError && byContactInfo) {
              existing = byContactInfo;
            }
          }
        }

        if (!existing && sync_leads) {
          const { error: insertError } = await supabase
            .from('client_pipeline')
            .insert({
              is_lead: true,
              stage_id: defaultStage?.id,
              lead_name: contact.name || 'Contato Chatwoot',
              lead_phone: contact.phone_number,
              lead_email: contact.email,
              chatwoot_conversation_id: conv.id,
              notes: `Importado de conversa aberta no Chatwoot (ID Conv: ${conv.id})\nAvatar: ${contact.thumbnail || ''}`
            });
          
          if (!insertError) {
            syncedCount++;
          } else {
            console.error(`Error inserting lead ${contact.name}:`, insertError);
          }
        } else if (existing && sync_conversations) {
          const msgRes = await fetch(`${baseUrl}/conversations/${conv.id}/messages`, { headers });
          if (!msgRes.ok) continue;
          
          const msgData = await msgRes.json();
          const messages = msgData.payload || msgData.data || (Array.isArray(msgData) ? msgData : []);

          const conversationText = messages
            .filter((m: any) => m.message_type === 0 || m.message_type === 1)
            .slice(-5)
            .map((m: any) => `${m.message_type === 0 ? 'Cliente' : 'Atendente'}: ${m.content || '[Arquivo/Imagem]'}`)
            .join('\n');

          const updateData: any = {
            chatwoot_conversation_id: conv.id,
            is_lead: true,
            last_interaction_at: new Date().toISOString()
          };

          if (conversationText && !existing.notes?.includes(conversationText.substring(0, 50))) {
            updateData.notes = `Chatwoot (${conv.id}):\n${conversationText}\n\n${existing.notes || ''}`.substring(0, 1000);
          }

          await supabase
            .from('client_pipeline')
            .update(updateData)
            .eq('id', existing.id);
        }
      }

      // 3. Logic to remove leads that no longer have an active conversation
      // We'll delete them if they have a chatwoot_conversation_id, it's NOT in allConvIds, and they haven't been converted to clients
      if (allConvIds.length > 0) {
        const { error: closeError } = await supabase
          .from('client_pipeline')
          .delete()
          .is('cliente_id', null)
          .not('chatwoot_conversation_id', 'is', null)
          .not('chatwoot_conversation_id', 'in', `(${allConvIds.join(',')})`);
        
        if (closeError) {
          console.error("Error deleting finished conversations:", closeError);
        }
      } else {
        // If NO open conversations, delete ALL that had a chatwoot_id and were not converted
        await supabase
          .from('client_pipeline')
          .delete()
          .is('cliente_id', null)
          .not('chatwoot_conversation_id', 'is', null);
      }
    }

    return new Response(
      JSON.stringify({ success: true, syncedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
