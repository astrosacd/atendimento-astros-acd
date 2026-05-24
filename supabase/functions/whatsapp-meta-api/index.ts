import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, accessToken, wabaId, phoneNumberId } = await req.json();

    if (action === "fetch-templates") {
      if (!accessToken || !wabaId) {
        throw new Error("Access Token e WABA ID são obrigatórios para buscar templates");
      }

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Erro ao buscar templates na Meta");
      }

      return new Response(JSON.stringify({ templates: data.data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-webhook-info") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/webhook-proxy?provider=meta`;
      
      return new Response(JSON.stringify({ 
        webhookUrl,
        verifyToken: "lovable_meta_verify_token" // Custom token for the user to set in Meta
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação não suportada");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
