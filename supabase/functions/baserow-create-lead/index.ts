import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateLeadRequest {
  module: 'proposals' | 'followups';
  event: string;
  lead_name: string;
  lead_phone: string;
  lead_date?: string;
  lead_produto?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CreateLeadRequest = await req.json();
    const { module, event, lead_name, lead_phone, lead_date, lead_produto } = body;

    if (!module || !event || !lead_name || !lead_phone) {
      return new Response(JSON.stringify({ error: "Missing required fields: module, event, lead_name, lead_phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate module
    if (module !== 'proposals' && module !== 'followups') {
      return new Response(JSON.stringify({ error: "Invalid module" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📦 Baserow create-lead: module=${module}, event=${event}, name=${lead_name}`);

    // Fetch Baserow config for this module
    const { data: config, error: configError } = await supabase
      .from('baserow_integrations')
      .select('*')
      .eq('module', module)
      .single();

    if (configError || !config) {
      console.log(`⏭️ No Baserow config for module: ${module}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'No config found' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.is_enabled) {
      console.log(`⏭️ Baserow disabled for module: ${module}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'Disabled' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if event is enabled
    if (!config.events || !config.events.includes(event)) {
      console.log(`⏭️ Event ${event} not enabled for module: ${module}`);
      return new Response(JSON.stringify({ skipped: true, reason: `Event ${event} not enabled` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.api_url || !config.api_token || !config.table_id) {
      console.error('❌ Baserow credentials incomplete');
      return new Response(JSON.stringify({ error: "Baserow credentials incomplete" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number - remove non-digits
    const cleanPhone = lead_phone.replace(/\D/g, '');
    const dateStr = lead_date || new Date().toLocaleDateString('pt-BR');

    const baseUrl = config.api_url.replace(/\/$/, '');
    const listEndpoint = `${baseUrl}/api/database/rows/table/${config.table_id}/?user_field_names=true`;
    const headers = {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    };

    const number1 = `${cleanPhone}@s.whatsapp.net`;
    const number2 = `+${cleanPhone}`;

    const results = [];

    // Process each number format: check if exists, then create or update
    for (const numero of [number1, number2]) {
      try {
        // Search for existing row by Número field
        const searchUrl = `${listEndpoint}&filter__field__Número__equal=${encodeURIComponent(numero)}&size=1`;
        const searchResp = await fetch(searchUrl, { method: 'GET', headers });
        const searchData = await searchResp.json();

        if (searchResp.ok && searchData.results && searchData.results.length > 0) {
          // Row exists — just update the boolean "Atende Humano" to true
          const existingRow = searchData.results[0];
          const rowId = existingRow.id;

          const updateUrl = `${baseUrl}/api/database/rows/table/${config.table_id}/${rowId}/?user_field_names=true`;
          const updateResp = await fetch(updateUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ 'Atende Humano': true }),
          });
          const updateData = await updateResp.text();

          if (updateResp.ok) {
            console.log(`✅ Baserow row updated (${numero}) — Atende Humano = true`);
            results.push({ numero, action: 'updated', success: true });
          } else {
            console.error(`❌ Baserow update error: ${updateResp.status} - ${updateData}`);
            results.push({ numero, action: 'update_failed', success: false, error: updateData });
          }
        } else {
          // Row does not exist — create new
          const createUrl = `${baseUrl}/api/database/rows/table/${config.table_id}/?user_field_names=true`;
          const createResp = await fetch(createUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              'Name': lead_name,
              'Número': numero,
              'Data': dateStr,
              'Atende Humano': true,
            }),
          });
          const createData = await createResp.text();

          if (createResp.ok) {
            console.log(`✅ Baserow row created (${numero})`);
            results.push({ numero, action: 'created', success: true });
          } else {
            console.error(`❌ Baserow create error: ${createResp.status} - ${createData}`);
            results.push({ numero, action: 'create_failed', success: false, error: createData });
          }
        }
      } catch (err: any) {
        console.error(`❌ Baserow error for ${numero}:`, err.message);
        results.push({ numero, action: 'error', success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('❌ General error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
