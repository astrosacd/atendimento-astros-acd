import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize phone to E.164 format (Twilio requires + prefix)
function normalizeToE164(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: 'Número vazio.' };
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return { ok: false, reason: 'Número sem dígitos válidos.' };

  // If user typed BR local format (10 or 11 digits), prepend 55
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }

  // Basic E.164 sanity: between 8 and 15 digits total
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, reason: `Número com tamanho inválido (${digits.length} dígitos). Use DDI + DDD + Número (ex: 5585999998888).` };
  }

  return { ok: true, value: '+' + digits };
}

function friendlyTwilioError(code: number | undefined, message: string, to: string, from?: string): string {
  if (code === 21211) {
    return `Número de destino inválido: ${to}. Verifique se está no formato DDI + DDD + Número (ex: 5585999998888) e se foi VERIFICADO na sua conta Trial do Twilio.`;
  }
  if (code === 21608 || code === 21219) {
    return `Número ${to} NÃO está verificado na sua conta Trial do Twilio. Contas Trial só enviam SMS para números previamente verificados.`;
  }
  if (code === 21614) {
    return `Número ${to} não é capaz de receber SMS (provavelmente é um telefone fixo).`;
  }
  if (code === 21659) {
    return `❌ CONFIGURAÇÃO ERRADA: O número remetente ${from} NÃO é um número do Twilio. Você está usando um número VERIFICADO como remetente, mas o Twilio exige que o "From" seja um número COMPRADO no Twilio (aparece em Phone Numbers → Active Numbers no console). Em contas Trial, o Twilio fornece UM número grátis (geralmente americano +1...). Acesse https://console.twilio.com/us1/develop/phone-numbers/manage/incoming e use esse número em Ligações IA → Configurações → Twilio Phone Number.`;
  }
  if (code === 21408) {
    return `Sua conta Twilio não tem permissão geográfica para enviar SMS para este país.`;
  }
  if (code === 20003) {
    return `Credenciais do Twilio inválidas. Revise as configurações em Ligações IA.`;
  }
  if (code === 21610) {
    return `O destinatário enviou STOP/CANCEL e bloqueou mensagens do seu número Twilio.`;
  }
  return message || 'Erro desconhecido ao enviar SMS via Twilio.';
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

    const payload = await req.json()
    let { to, body, cliente_id, template_id, variables, source } = payload

    // If we have cliente_id, try to get info if not provided
    let clienteNome = "";
    if (cliente_id && (!to || !variables?.nome)) {
      const { data: cliente } = await supabaseClient
        .from('clientes')
        .select('nome, numero')
        .eq('id', cliente_id)
        .maybeSingle()
      
      if (cliente) {
        if (!to) to = cliente.numero
        clienteNome = cliente.nome || ""
      }
    }

    // If we have template_id, use its content
    if (template_id && !body) {
      const { data: template } = await supabaseClient
        .from('sms_templates')
        .select('conteudo')
        .eq('id', template_id)
        .maybeSingle()
      
      if (template) {
        body = template.conteudo
      } else {
        throw new Error("Template não encontrado")
      }
    }

    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'Número (to) e corpo (body/template) são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Variable substitution
    const finalVariables = { nome: clienteNome, ...(variables || {}) };
    let finalBody = body;
    Object.entries(finalVariables).forEach(([key, val]) => {
      const regex = new RegExp(`{${key}}`, 'gi');
      finalBody = finalBody.replace(regex, String(val || ''));
    });

    // Normalize destination to E.164
    const normalized = normalizeToE164(to);
    if (!normalized.ok) {
      return new Response(JSON.stringify({ error: normalized.reason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    const toE164 = normalized.value;

    // Get Twilio config
    const { data: configData } = await supabaseClient
      .from('ligacoes_ia_config')
      .select('config_key, config_value')
      .in('config_key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number'])

    const config: Record<string, string> = {}
    configData?.forEach((r: any) => config[r.config_key] = r.config_value)

    if (!config.twilio_account_sid || !config.twilio_auth_token || !config.twilio_phone_number) {
      throw new Error('Configuração do Twilio incompleta. Configure em Ligações IA → Configurações.')
    }

    // Normalize From number
    const fromNormalized = normalizeToE164(config.twilio_phone_number);
    const fromE164 = fromNormalized.ok ? fromNormalized.value : config.twilio_phone_number;

    const auth = btoa(`${config.twilio_account_sid}:${config.twilio_auth_token}`)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio_account_sid}/Messages.json`

    const params = new URLSearchParams()
    params.append('To', toE164)
    params.append('From', fromE164)
    params.append('Body', finalBody)

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

    const friendly = response.ok ? null : friendlyTwilioError(twilioData.code, twilioData.message, toE164, fromE164);

    const { data: hist } = await supabaseClient.from('sms_history').insert({
      cliente_id: cliente_id || null,
      numero_destino: toE164,
      conteudo: finalBody,
      status: response.ok ? 'enviado' : 'erro',
      provider_message_id: twilioData.sid || null,
      error_message: response.ok ? null : friendly,
      source: source || 'manual',
      created_by: userData.user?.id || null
    }).select().single()

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: friendly,
        id: hist?.id,
        twilio_code: twilioData.code ?? null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    return new Response(JSON.stringify({ success: true, id: hist?.id, sid: twilioData.sid, to: toE164 }), {
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
