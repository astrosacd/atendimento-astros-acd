import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CheckResult = { status: 'online' | 'offline' | 'warning'; message: string | null; details?: any };

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms) - ${label}`)), ms))
  ]);
}

async function checkEvolution(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('proposal_send_config').select('evolution_api_url, evolution_api_key').limit(1).maybeSingle();
  let url = data?.evolution_api_url;
  let key = data?.evolution_api_key;

  if (!url || !key) return { status: 'warning', message: 'Sem URL/Chave no CRM.' };
  
  try {
    const res = await withTimeout(fetch(`${url.replace(/\/$/, '')}/instance/fetchInstances`, {
      headers: { 'apikey': key }
    }), 8000, 'Evolution');
    if (!res.ok) return { status: 'offline', message: `Erro HTTP ${res.status} (Chave incorreta?)` };
    const data = await res.json().catch(() => null);
    const count = Array.isArray(data) ? data.length : 0;
    return { status: 'online', message: `Conectado. ${count} instâncias ativas.`, details: { instances: count } };
  } catch (e: any) {
    return { status: 'offline', message: `Falha de conexão: ${e.message}` };
  }
}

async function checkMercadoPago(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('billing_config').select('config_value').eq('config_key', 'mp_access_token').maybeSingle();
  const token = data?.config_value;
  
  if (!token) return { status: 'warning', message: 'Access Token não configurado no Financeiro.' };
  
  try {
    const res = await withTimeout(fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }), 8000, 'MercadoPago');
    if (!res.ok) return { status: 'offline', message: `Token rejeitado pelo Mercado Pago (HTTP ${res.status}).` };
    const data = await res.json();
    return { status: 'online', message: `Conta vinculada: ${data.email || data.nickname}` };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkStripe(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('billing_stripe_config').select('stripe_secret_key').limit(1).maybeSingle();
  const key = data?.stripe_secret_key;
  
  if (!key) return { status: 'warning', message: 'Secret Key não configurada no Financeiro.' };
  
  try {
    const res = await withTimeout(fetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${key}` }
    }), 8000, 'Stripe');
    if (!res.ok) return { status: 'offline', message: `Chave Stripe inválida (HTTP ${res.status}).` };
    return { status: 'online', message: 'Conexão validada com sucesso.' };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkSerper(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('lead_hunter_config').select('config_value').eq('config_key', 'serp_api_key').maybeSingle();
  const key = data?.config_value;
  
  if (!key) {
    await supabase.from('api_quotas').delete().eq('api_name', 'serper_api');
    return { status: 'warning', message: 'Chave não encontrada no Lead Hunter.' };
  }
  
  try {
    const res = await withTimeout(fetch(`https://serpapi.com/account?api_key=${key}`), 8000, 'SerpApi');
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      await supabase.from('api_quotas').delete().eq('api_name', 'serper_api');
      return { status: 'offline', message: `API Key inválida. Erro: ${data.error || 'Unauthorized'}` };
    }
    
    // Os campos reais da SerpApi conforme o JSON fornecido pelo usuário
    const creditsLeft = data.total_searches_left ?? 0;
    const monthlyMax = data.searches_per_month ?? 0;
    
    await supabase.from('api_quotas').upsert({
      api_name: 'serper_api',
      display_name: 'Buscas SerpApi (Lead Hunter)',
      current_value: creditsLeft,
      max_value: monthlyMax,
      limit_type: 'credits',
      last_updated: new Date().toISOString()
    }, { onConflict: 'api_name' });

    return { 
      status: 'online', 
      message: `Plano ${data.plan_name || 'Ativo'}: ${creditsLeft.toLocaleString()} buscas restantes.`, 
      details: { credits: creditsLeft, max_value: monthlyMax, plan: data.plan_name } 
    };
  } catch (e: any) {
    return { status: 'offline', message: `Erro de conexão: ${e.message}` };
  }
}

async function checkGmail(supabase: any): Promise<CheckResult> {
  const { data: billing } = await supabase.from('billing_config').select('config_key, config_value').in('config_key', ['billing_gmail_user', 'billing_gmail_password']);
  
  const user = billing?.find((c: any) => c.config_key === 'billing_gmail_user')?.config_value;
  const pass = billing?.find((c: any) => c.config_key === 'billing_gmail_password')?.config_value;
  
  if (!user || !pass) return { status: 'warning', message: 'E-mail ou Senha de App não configurados.' };
  return { status: 'online', message: `Pronto para disparos via ${user}.` };
}

async function checkGoogleCalendar(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('calendar_config').select('config_key, config_value');
  
  const clientId = data?.find((c: any) => c.config_key === 'google_client_id')?.config_value;
  const clientSecret = data?.find((c: any) => c.config_key === 'google_client_secret')?.config_value;
  const refreshToken = data?.find((c: any) => c.config_key === 'google_refresh_token')?.config_value;

  if (!clientId || !clientSecret || !refreshToken) {
    return { status: 'warning', message: 'Credenciais OAuth (Client ID/Secret) não encontradas.' };
  }

  try {
    const res = await withTimeout(fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    }), 8000, 'GoogleCalendar');

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { status: 'offline', message: `Token inválido ou expirado: ${errorData.error_description || errorData.error}` };
    }

    return { status: 'online', message: 'Acesso à Agenda Google validado.' };
  } catch (e: any) {
    return { status: 'offline', message: `Erro de autenticação: ${e.message}` };
  }
}

async function checkWhatsAppOfficial(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('meta_credentials').select('access_token, phone_number_id').limit(1).maybeSingle();
  const token = data?.access_token;
  const phoneId = data?.phone_number_id;
  
  if (!token) {
    await supabase.from('api_quotas').delete().eq('api_name', 'meta_whatsapp');
    return { status: 'warning', message: 'Sem Access Token da Meta.' };
  }
  
  try {
    const url = phoneId 
      ? `https://graph.facebook.com/v21.0/${phoneId}?access_token=${token}`
      : `https://graph.facebook.com/v21.0/me?access_token=${token}`;
      
    const res = await withTimeout(fetch(url), 8000, 'WhatsAppMeta');
    const responseData = await res.json();
    
    if (!res.ok) {
      await supabase.from('api_quotas').delete().eq('api_name', 'meta_whatsapp');
      return { 
        status: 'offline', 
        message: `Token rejeitado pela Meta: ${responseData.error?.message || `Erro HTTP ${res.status}`}` 
      };
    }
    
    return { 
      status: 'online', 
      message: `Número: ${responseData.display_phone_number || 'Ativo'} (ID: ${responseData.id})`,
      details: { account_id: responseData.id }
    };
  } catch (e: any) {
    return { status: 'offline', message: `Falha na requisição Meta: ${e.message}` };
  }
}

async function checkInstagramAPI(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('instagram_settings').select('access_token, instagram_business_account_id').limit(1).maybeSingle();
  const token = data?.access_token;
  const instaId = data?.instagram_business_account_id;
  
  if (!token) {
    return { status: 'warning', message: 'Sem Access Token do Instagram.' };
  }
  
  try {
    const url = instaId 
      ? `https://graph.facebook.com/v21.0/${instaId}?fields=username,name&access_token=${token}`
      : `https://graph.facebook.com/v21.0/me?access_token=${token}`;
 
    const res = await withTimeout(fetch(url), 8000, 'InstagramMeta');
    const responseData = await res.json();
 
    if (!res.ok) {
      return { 
        status: 'offline', 
        message: `Token rejeitado pelo Instagram: ${responseData.error?.message || `Erro HTTP ${res.status}`}` 
      };
    }
 
    return { 
      status: 'online', 
      message: `Perfil: @${responseData.username || 'Ativo'} (ID: ${responseData.id})`,
      details: { instagram_id: responseData.id }
    };
  } catch (e: any) {
    return { status: 'offline', message: `Falha na requisição Instagram: ${e.message}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const checks: Record<string, () => Promise<CheckResult>> = {
      whatsapp_official: () => checkWhatsAppOfficial(supabase),
      instagram_api: () => checkInstagramAPI(supabase),
      evolution_api: () => checkEvolution(supabase),
      google_calendar: () => checkGoogleCalendar(supabase),
      mercadopago: () => checkMercadoPago(supabase),
      stripe: () => checkStripe(supabase),
      serper_api: () => checkSerper(supabase),
      gmail: () => checkGmail(supabase),
    };

    const results: any[] = [];
    for (const [name, fn] of Object.entries(checks)) {
      const start = Date.now();
      let result: CheckResult;
      try {
        result = await fn();
      } catch (e: any) {
        result = { status: 'offline', message: e.message || 'Erro desconhecido na verificação.' };
      }
      const responseTime = Date.now() - start;

      const { data: prev } = await supabase
        .from('integration_status')
        .select('status')
        .eq('integration_name', name)
        .maybeSingle();

      await supabase
        .from('integration_status')
        .update({
          status: result.status,
          error_message: result.status === 'online' ? null : result.message,
          response_time_ms: responseTime,
          last_check: new Date().toISOString(),
          metadata: result.details || {},
        })
        .eq('integration_name', name);

      if (!prev || prev.status !== result.status || result.status !== 'online') {
        await supabase.from('integration_logs').insert({
          integration_name: name,
          status: result.status,
          message: result.message || `Verificação: ${result.status}`,
          details: { response_time_ms: responseTime, ...(result.details || {}) }
        });
      }

      results.push({ name, status: result.status, message: result.message, responseTime });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('system-health-check error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});