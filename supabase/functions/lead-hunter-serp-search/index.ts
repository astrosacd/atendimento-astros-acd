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

    const { query, location, campanhaId } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "Query é obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get SERP API key from config
    const { data: configData } = await supabase
      .from("lead_hunter_config")
      .select("config_value")
      .eq("config_key", "serp_api_key")
      .single();

    const serpApiKey = configData?.config_value;
    if (!serpApiKey) {
      return new Response(JSON.stringify({ error: "SERP API Key não configurada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create search record
    const { data: busca, error: buscaError } = await supabase
      .from("lead_hunter_buscas")
      .insert({ query, localizacao: location || null, status: "processando" })
      .select()
      .single();

    if (buscaError) throw buscaError;

    // Call SERP API for Google Maps
    const searchQuery = location ? `${query} ${location}` : query;
    const serpUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(searchQuery)}&api_key=${serpApiKey}&hl=pt-br`;

    const serpResponse = await fetch(serpUrl);
    const serpData = await serpResponse.json();

    if (serpData.error) {
      await supabase.from("lead_hunter_buscas").update({ status: "erro", erro_mensagem: serpData.error }).eq("id", busca.id);
      return new Response(JSON.stringify({ error: serpData.error }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = serpData.local_results || [];
    let imported = 0;
    let skipped = 0;

    for (const result of results) {
      const phone = result.phone?.replace(/\D/g, "");
      if (!phone) { skipped++; continue; }

      // Normalize Brazilian phone number
      let normalizedPhone = phone;
      if (!normalizedPhone.startsWith("55") && normalizedPhone.length <= 11) {
        normalizedPhone = "55" + normalizedPhone;
      }

      const { error: insertError } = await supabase.from("lead_hunter_leads").insert({
        nome: result.title || null,
        telefone: normalizedPhone,
        empresa: result.title || null,
        website: result.website || null,
        endereco: result.address || null,
        cidade: result.city || location || null,
        categoria: result.type || null,
        avaliacao: result.rating || null,
        fonte: "serp_google_maps",
        campanha_id: campanhaId || null,
        dados_extras: {
          place_id: result.place_id,
          reviews: result.reviews,
          thumbnail: result.thumbnail,
          gps_coordinates: result.gps_coordinates,
        },
      });

      if (insertError) {
        if (insertError.code === "23505") skipped++;
        else console.error("Insert error:", insertError);
      } else {
        imported++;
      }
    }

    // Update search record
    await supabase.from("lead_hunter_buscas").update({
      status: "concluida",
      total_resultados: imported,
    }).eq("id", busca.id);

    // Log
    await supabase.from("lead_hunter_logs").insert({
      tipo: "busca",
      resultado: "success",
      mensagem: `Busca "${query}": ${imported} importados, ${skipped} pulados (duplicados/sem telefone)`,
      detalhes: { query, location, total_results: results.length, imported, skipped },
    });

    return new Response(JSON.stringify({
      success: true,
      totalResults: imported,
      skipped,
      message: `${imported} leads importados, ${skipped} pulados`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("SERP search error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
