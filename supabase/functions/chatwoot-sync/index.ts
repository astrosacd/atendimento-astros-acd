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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

    const baseUrl = `${chatwoot_url.replace(/\/$/, '')}/api/v1/accounts/${account_id}`;
    const headers = {
      "api_access_token": chatwoot_api_key,
      "Content-Type": "application/json"
    };

    let syncedCount = 0;

    if (sync_leads) {
      console.log(`Fetching contacts from: ${baseUrl}/contacts`);
      // Fetch contacts
      const contactsRes = await fetch(`${baseUrl}/contacts`, { headers });
      
      if (!contactsRes.ok) {
        const errorText = await contactsRes.text();
        console.error(`Chatwoot API error (${contactsRes.status}):`, errorText);
        throw new Error(`Erro ao buscar contatos: ${contactsRes.statusText}`);
      }
      
      const responseData = await contactsRes.json();
      const contacts = responseData.payload || responseData.data || (Array.isArray(responseData) ? responseData : []);
      
      console.log(`Found ${contacts.length} contacts in current page`);

      for (const contact of contacts) {
        // Skip if no phone or email
        if (!contact.phone_number && !contact.email) {
          continue;
        }

        // Check if lead already exists in pipeline
        const { data: existing } = await supabase
          .from('client_pipeline')
          .select('id')
          .or(`lead_phone.eq.${contact.phone_number},lead_email.eq.${contact.email}`)
          .maybeSingle();

        if (!existing) {
          // Insert new lead
          const { error: insertError } = await supabase
            .from('client_pipeline')
            .insert({
              is_lead: true,
              lead_name: contact.name,
              lead_phone: contact.phone_number,
              lead_email: contact.email,
              notes: `Importado do Chatwoot (ID: ${contact.id})`
            });
          
          if (!insertError) {
            syncedCount++;
          } else {
            console.error("Error inserting lead:", insertError);
          }
        }
      }
    }

    if (sync_conversations) {
      console.log("Syncing conversations...");
      const { data: pipelineItems } = await supabase
        .from('client_pipeline')
        .select('*')
        .eq('is_lead', true);

      if (pipelineItems) {
        for (const item of pipelineItems) {
          const searchVal = item.lead_phone || item.lead_email;
          if (!searchVal) continue;

          const contactSearchRes = await fetch(`${baseUrl}/contacts/search?q=${encodeURIComponent(searchVal)}`, { headers });
          if (!contactSearchRes.ok) continue;
          
          const searchData = await contactSearchRes.json();
          const contactsFound = searchData.payload || searchData.data || (Array.isArray(searchData) ? searchData : []);
          const contact = contactsFound[0];

          if (contact) {
            const convRes = await fetch(`${baseUrl}/contacts/${contact.id}/conversations`, { headers });
            if (!convRes.ok) continue;
            
            const convData = await convRes.json();
            const conversations = convData.payload || convData.data || (Array.isArray(convData) ? convData : []);

            if (conversations.length > 0) {
              const lastConv = conversations[0];
              const msgRes = await fetch(`${baseUrl}/conversations/${lastConv.id}/messages`, { headers });
              if (!msgRes.ok) continue;
              
              const msgData = await msgRes.json();
              const messages = msgData.payload || msgData.data || (Array.isArray(msgData) ? msgData : []);

              const conversationText = messages
                .filter((m: any) => m.message_type === 0 || m.message_type === 1)
                .slice(0, 5)
                .map((m: any) => `${m.message_type === 0 ? 'Cliente' : 'Atendente'}: ${m.content}`)
                .join('\n');

              if (conversationText) {
                await supabase
                  .from('client_pipeline')
                  .update({
                    notes: `Última conversa Chatwoot:\n${conversationText}\n\n${item.notes || ''}`.substring(0, 1000),
                    last_interaction_at: new Date().toISOString()
                  })
                  .eq('id', item.id);
              }
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
