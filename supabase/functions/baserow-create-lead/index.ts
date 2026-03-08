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

    // Create 2 rows in Baserow:
    // Row 1: number with @s.whatsapp.net format
    // Row 2: number with + prefix
    const baseUrl = config.api_url.replace(/\/$/, '');
    const apiEndpoint = `${baseUrl}/api/database/rows/table/${config.table_id}/?user_field_names=true`;

    const headers = {
      'Authorization': `Token ${config.api_token}`,
      'Content-Type': 'application/json',
    };

    const row1 = {
      'Name': lead_name,
      'Número': `${cleanPhone}@s.whatsapp.net`,
      'Data': dateStr,
    };

    const row2 = {
      'Name': lead_name,
      'Número': `+${cleanPhone}`,
      'Data': dateStr,
    };

    const results = [];

    // Create row 1
    try {
      const resp1 = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(row1),
      });
      const data1 = await resp1.text();
      if (!resp1.ok) {
        console.error(`❌ Baserow row 1 error: ${resp1.status} - ${data1}`);
        results.push({ row: 1, success: false, error: data1 });
      } else {
        console.log(`✅ Baserow row 1 created (${cleanPhone}@s.whatsapp.net)`);
        results.push({ row: 1, success: true });
      }
    } catch (err: any) {
      console.error(`❌ Baserow row 1 fetch error:`, err.message);
      results.push({ row: 1, success: false, error: err.message });
    }

    // Create row 2
    try {
      const resp2 = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(row2),
      });
      const data2 = await resp2.text();
      if (!resp2.ok) {
        console.error(`❌ Baserow row 2 error: ${resp2.status} - ${data2}`);
        results.push({ row: 2, success: false, error: data2 });
      } else {
        console.log(`✅ Baserow row 2 created (+${cleanPhone})`);
        results.push({ row: 2, success: true });
      }
    } catch (err: any) {
      console.error(`❌ Baserow row 2 fetch error:`, err.message);
      results.push({ row: 2, success: false, error: err.message });
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
