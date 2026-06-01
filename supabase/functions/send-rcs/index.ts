import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-temp-access-token, apikey, content-type',
}

function normalizeToE164(raw: string): string {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  if (cleaned.startsWith('+')) {
    return '+' + cleaned.substring(1).replace(/\D/g, '');
  }
  let digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return '+' + digits;
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

    const { to, body, session_id } = await req.json()

    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'Número e mensagem são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get Twilio config
    const { data: configData } = await supabaseClient
      .from('ligacoes_ia_config')
      .select('config_key, config_value')
      .in('config_key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_messaging_service_sid'])

    const config: Record<string, string> = {}
    configData?.forEach((r: any) => config[r.config_key] = r.config_value)

    if (!config.twilio_account_sid || !config.twilio_auth_token || !config.twilio_messaging_service_sid) {
      throw new Error('Configuração do Twilio para RCS incompleta. Verifique o Messaging Service SID.')
    }

    const toE164 = normalizeToE164(to);
    const auth = btoa(`${config.twilio_account_sid}:${config.twilio_auth_token}`)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio_account_sid}/Messages.json`

    const params = new URLSearchParams()
    params.append('To', toE164)
    params.append('MessagingServiceSid', config.twilio_messaging_service_sid)
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
    const { data: userData } = await supabaseClient.auth.getUser(req.headers.get('Authorization')?.split(' ')[1] ?? '')

    // Log the message in rcs_messages
    const { error: logError } = await supabaseClient.from('rcs_messages').insert({
      session_id: session_id || null,
      numero_destino: toE164,
      conteudo: body,
      status: response.ok ? 'enviado' : 'erro',
      error_message: response.ok ? null : (twilioData.message || 'Erro no Twilio'),
      user_id: userData.user?.id || null
    })

    if (logError) {
      console.error('[send-rcs] Falha ao registrar histórico:', logError)
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: twilioData.message || 'Erro ao enviar RCS', details: twilioData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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