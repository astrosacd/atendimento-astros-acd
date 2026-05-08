import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get all integrations to check
    const { data: integrations, error: fetchError } = await supabaseClient
      .from('integration_status')
      .select('*')

    if (fetchError) throw fetchError

    const results = []

    for (const integration of integrations) {
      const startTime = Date.now()
      let status = 'online'
      let errorMessage = null
      
      try {
        // Implement specific checks for each integration
        switch (integration.integration_name) {
          case 'meta_whatsapp':
            // Simple ping or token validation if available
            // For now, simulating success
            break
          case 'evolution_api':
            // Check if Evolution API URL is responsive
            break
          case 'serper_api':
            // Check quota or simple search if key exists
            break
          default:
            // Generic check: maybe just mark as online if no specific logic
            break
        }
      } catch (e) {
        status = 'offline'
        errorMessage = e.message
      }

      const responseTime = Date.now() - startTime

      // Update status
      const { error: updateError } = await supabaseClient
        .from('integration_status')
        .update({
          status,
          error_message: errorMessage,
          response_time_ms: responseTime,
          last_check: new Date().toISOString()
        })
        .eq('integration_name', integration.integration_name)

      if (updateError) console.error(`Error updating ${integration.integration_name}:`, updateError)

      // Log the result if status changed or it's offline
      if (status !== 'online' || integration.status !== status) {
        await supabaseClient
          .from('integration_logs')
          .insert({
            integration_name: integration.integration_name,
            status,
            message: errorMessage || `Verificação de rotina: ${status}`,
            details: { response_time_ms: responseTime }
          })
      }

      results.push({ name: integration.integration_name, status, responseTime })
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
