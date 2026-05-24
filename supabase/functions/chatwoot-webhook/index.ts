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
    const payload = await req.json();
    const event = payload.event;
    // Chatwoot payloads can vary depending on the event type
    const conversation = payload.conversation || payload.data?.conversation || (payload.id && payload.status ? payload : null);
    const accountId = payload.account?.id || payload.account_id;

    console.log(`Chatwoot Webhook Event: ${event} for Account: ${accountId}`);

    if (!event || !conversation) {
      console.log("Invalid payload received:", JSON.stringify(payload).substring(0, 500));
      return new Response(JSON.stringify({ message: "Payload inválido ou incompleto" }), { 
        status: 200, // Returning 200 to not make Chatwoot retry indefinitely on bad payloads
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get config
    const { data: config } = await supabase
      .from('pipeline_chatwoot_config')
      .select('*')
      .maybeSingle();

    if (!config || !config.enabled) {
      return new Response(JSON.stringify({ message: "Integração desabilitada" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const convId = conversation.id;
    const contact = conversation.meta?.sender || payload.sender || conversation.sender || payload.data?.sender;

    // Handle resolution
    if (event === 'conversation_resolved' || (event === 'conversation_status_changed' && conversation.status === 'resolved')) {
      // Remove from pipeline if not converted to a formal client
      const { error: deleteError } = await supabase
        .from('client_pipeline')
        .delete()
        .eq('chatwoot_conversation_id', convId)
        .is('cliente_id', null);
      
      if (deleteError) {
        console.error(`Error removing lead ${convId}:`, deleteError);
      } else {
        console.log(`Lead removed from pipeline (Resolved): ${convId}`);
      }
    } 
    // Handle creation or updates
    else if (event === 'conversation_created' || event === 'conversation_updated' || event === 'message_created' || event === 'conversation_status_changed') {
      
      // Only process if it's an open or pending conversation
      if (conversation.status === 'open' || conversation.status === 'pending') {
        // Find existing
        let { data: existing } = await supabase
          .from('client_pipeline')
          .select('*')
          .eq('chatwoot_conversation_id', convId)
          .maybeSingle();

        if (!existing && contact && config.sync_leads) {
          // Get default stage
          const { data: defaultStage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('is_default', true)
            .maybeSingle();

          // Create new lead
          const { error: insertError } = await supabase
            .from('client_pipeline')
            .insert({
              is_lead: true,
              stage_id: defaultStage?.id,
              lead_name: contact.name || 'Contato Chatwoot',
              lead_phone: contact.phone_number,
              lead_email: contact.email,
              chatwoot_conversation_id: convId,
              notes: `Criado via Webhook Chatwoot (ID Conv: ${convId})\nEvento: ${event}`
            });
            
          if (insertError) {
            console.error(`Error creating lead ${convId}:`, insertError);
          } else {
            console.log(`Lead created via webhook: ${convId}`);
          }
        } else if (existing) {
           // Update interaction timestamp
           await supabase
            .from('client_pipeline')
            .update({
              last_interaction_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        }
      } 
      // If it was resolved during an update/status change
      else if (conversation.status === 'resolved') {
        await supabase
          .from('client_pipeline')
          .delete()
          .eq('chatwoot_conversation_id', convId)
          .is('cliente_id', null);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
