import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { to, body, cliente_id, source } = await req.json()

    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'Número (to) e corpo (body) são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get Twilio config
    const { data: configData } = await supabaseClient
      .from('ligacoes_ia_config')
      .select('config_key, config_value')
      .in('config_key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number'])

    const config: Record<string, string> = {}
    configData?.forEach((r: any) => config[r.config_key] = r.config_value)

    if (!config.twilio_account_sid || !config.twilio_auth_token || !config.twilio_phone_number) {
      throw new Error('Configuração do Twilio incompleta')
    }

    const auth = btoa(`${config.twilio_account_sid}:${config.twilio_auth_token}`)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio_account_sid}/Messages.json`

    const params = new URLSearchParams()
    params.append('To', to)
    params.append('From', config.twilio_phone_number)
    params.append('Body', body)

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const twilioData = await response.json()

    // Log to sms_history
    const { data: userData } = await supabaseClient.auth.getUser(req.headers.get('Authorization')?.split(' ')[1] ?? '')
    
    await supabaseClient.from('sms_history').insert({
      cliente_id: cliente_id || null,
      numero_destino: to,
      conteudo: body,
      status: response.ok ? 'enviado' : 'erro',
      provider_message_id: twilioData.sid || null,
      error_message: response.ok ? null : twilioData.message,
      source: source || 'manual',
      created_by: userData.user?.id || null
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: twilioData.message || 'Erro ao enviar SMS' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(JSON.stringify({ success: true, sid: twilioData.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
