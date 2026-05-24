import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campanhaId } = await req.json();
    if (!campanhaId) {
      return new Response(JSON.stringify({ error: "campanhaId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaign
    const { data: campanha, error: campError } = await supabase
      .from("lead_hunter_campanhas")
      .select("*")
      .eq("id", campanhaId)
      .single();

    if (campError || !campanha) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending leads for this campaign
    const { data: leads } = await supabase
      .from("lead_hunter_leads")
      .select("id")
      .eq("campanha_id", campanhaId)
      .eq("status", "novo");

    if (!leads?.length) {
      return new Response(JSON.stringify({ message: "Nenhum lead novo na campanha" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update campaign status
    await supabase.from("lead_hunter_campanhas").update({ status: "ativa" }).eq("id", campanhaId);

    // Trigger send for all pending leads
    const leadIds = leads.map(l => l.id);
    
    const { data, error } = await fetch(`${supabaseUrl}/functions/v1/lead-hunter-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ leadIds }),
    }).then(r => r.json());

    // Update campaign status
    await supabase.from("lead_hunter_campanhas").update({ status: "concluida" }).eq("id", campanhaId);

    // Log
    await supabase.from("lead_hunter_logs").insert({
      campanha_id: campanhaId,
      tipo: "envio",
      resultado: "success",
      mensagem: `Campanha "${campanha.nome}" disparada: ${data?.sent || 0} enviados, ${data?.errors || 0} erros`,
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Campanha disparada! ${data?.sent || 0} enviados, ${data?.errors || 0} erros`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Dispatch error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
