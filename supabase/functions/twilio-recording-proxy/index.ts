import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      throw new Error('URL is required')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Twilio credentials from database
    const { data: config, error: configError } = await supabaseAdmin
      .from('ligacoes_ia_config')
      .select('config_key, config_value')
      .in('config_key', ['twilio_account_sid', 'twilio_auth_token'])

    if (configError) throw configError
    
    const twilioSid = config.find(c => c.config_key === 'twilio_account_sid')?.config_value
    const twilioToken = config.find(c => c.config_key === 'twilio_auth_token')?.config_value

    if (!twilioSid || !twilioToken) {
      throw new Error('Twilio credentials not found in configuration')
    }

    // Fetch from Twilio using Basic Auth
    const auth = btoa(`${twilioSid}:${twilioToken}`)
    const twilioResponse = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    })

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text()
      console.error('Twilio error:', errorText)
      throw new Error(`Failed to fetch from Twilio: ${twilioResponse.statusText}`)
    }

    const audioData = await twilioResponse.arrayBuffer()

    return new Response(audioData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="recording.mp3"',
      },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
