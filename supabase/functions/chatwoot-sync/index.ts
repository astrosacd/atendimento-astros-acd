import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { chatwoot_url, chatwoot_api_key, account_id, sync_leads, sync_conversations } = config;

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
      console.log(`Fetching open conversations from: ${baseUrl}/conversations?status=open`);
      const convsRes = await fetch(`${baseUrl}/conversations?status=open`, { headers });
      
      if (!convsRes.ok) {
        const errorText = await convsRes.text();
        console.error(`Chatwoot API error (${convsRes.status}):`, errorText);
        throw new Error(`Erro ao buscar conversas: ${convsRes.statusText}`);
      }
      
      const responseData = await convsRes.json();
      const conversations = responseData.payload || responseData.data || (Array.isArray(responseData) ? responseData : []);
      
      console.log(`Found ${conversations.length} open conversations`);

      for (const conv of conversations) {
        const contact = conv.meta?.sender;
        if (!contact) continue;

        // If no phone/email, we skip for now to avoid duplicates without unique keys
        if (!contact.phone_number && !contact.email) {
          continue;
        }

        // Normalize phone number (very basic, remove +)
        const cleanPhone = contact.phone_number ? contact.phone_number.replace(/\D/g, '') : null;
        
        // Check if lead already exists in pipeline by phone or email
        let query = supabase.from('client_pipeline').select('*');
        
        const conditions = [];
        if (cleanPhone) conditions.push(`lead_phone.ilike.%${cleanPhone}%`);
        if (contact.email) conditions.push(`lead_email.eq.${contact.email}`);
        
        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        }

        const { data: existing, error: searchError } = await query.maybeSingle();
        
        if (searchError) {
          console.error(`Error searching for existing lead (${contact.name}):`, searchError);
          continue;
        }

        if (!existing && sync_leads) {
          // Insert new lead from open conversation
          const { error: insertError } = await supabase
            .from('client_pipeline')
            .insert({
              is_lead: true,
              stage_id: defaultStage?.id,
              lead_name: contact.name || 'Contato Chatwoot',
              lead_phone: contact.phone_number,
              lead_email: contact.email,
              notes: `Importado de conversa aberta no Chatwoot (ID Conv: ${conv.id})\nAvatar: ${contact.thumbnail || ''}`
            });
          
          if (!insertError) {
            syncedCount++;
          } else {
            console.error(`Error inserting lead ${contact.name}:`, insertError);
          }
        } else if (existing && sync_conversations) {
          // Sync conversation content to existing lead
          const msgRes = await fetch(`${baseUrl}/conversations/${conv.id}/messages`, { headers });
          if (!msgRes.ok) continue;
          
          const msgData = await msgRes.json();
          const messages = msgData.payload || msgData.data || (Array.isArray(msgData) ? msgData : []);

          const conversationText = messages
            .filter((m: any) => m.message_type === 0 || m.message_type === 1)
            .slice(-5) // Get last 5 messages
            .map((m: any) => `${m.message_type === 0 ? 'Cliente' : 'Atendente'}: ${m.content || '[Arquivo/Imagem]'}`)
            .join('\n');

          if (conversationText) {
            // Update only if conversation text is different or notes don't contain it
            if (!existing.notes?.includes(conversationText.substring(0, 100))) {
              await supabase
                .from('client_pipeline')
                .update({
                  notes: `Conversa aberta Chatwoot (ID: ${conv.id}):\n${conversationText}\n\n${existing.notes || ''}`.substring(0, 1000),
                  last_interaction_at: new Date().toISOString()
                })
                .eq('id', existing.id);
            }
          }
        }
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