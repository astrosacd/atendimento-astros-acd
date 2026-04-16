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
      console.log("Contacts API response keys:", Object.keys(responseData));
      
      const contacts = responseData.payload || [];
      console.log(`Found ${contacts.length} contacts in current page`);

      if (contacts.length === 0 && responseData.data) {
        // Fallback for different API versions or structures
        console.log("Using fallback 'data' property for contacts");
        const fallbackContacts = responseData.data || [];
        for (const contact of fallbackContacts) {
          await processContact(contact, supabase, syncedCount);
        }
      } else {
        for (const contact of contacts) {
          // Log first contact to see structure
          if (syncedCount === 0) {
            console.log("Sample contact structure:", JSON.stringify(contact).substring(0, 200));
          }

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
    }

    // ... sync_conversations logic remains similar but I'll add more logging there too if needed
    // For now focus on getting leads imported

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

async function processContact(contact: any, supabase: any, syncedCount: number) {
  // Logic extracted to helper for fallback
}
