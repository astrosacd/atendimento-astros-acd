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
  let url = data?.evolution_api_url || Deno.env.get('EVOLUTION_API_URL');
  let key = data?.evolution_api_key || Deno.env.get('EVOLUTION_API_KEY');

  if (!url || !key) return { status: 'warning', message: 'Evolution API não configurada no CRM.' };
  
  try {
    const res = await withTimeout(fetch(`${url.replace(/\/$/, '')}/instance/fetchInstances`, {
      headers: { 'apikey': key }
    }), 8000, 'Evolution');
    if (!res.ok) return { status: 'offline', message: `Servidor respondeu HTTP ${res.status}.` };
    const data = await res.json().catch(() => null);
    const count = Array.isArray(data) ? data.length : 0;
    return { status: 'online', message: `Conectado. ${count} instância(s) ativa(s).`, details: { instances: count } };
  } catch (e: any) {
    return { status: 'offline', message: e.message || 'Erro de conexão com Evolution.' };
  }
}

async function checkMercadoPago(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('billing_config').select('config_value').eq('config_key', 'mp_access_token').maybeSingle();
  const token = data?.config_value || Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  
  if (!token) return { status: 'warning', message: 'Mercado Pago não configurado no CRM.' };
  
  try {
    const res = await withTimeout(fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }), 8000, 'MercadoPago');
    if (!res.ok) return { status: 'offline', message: `Token inválido ou erro HTTP ${res.status}. Verifique as credenciais no Financeiro.` };
    const data = await res.json();
    return { status: 'online', message: `Conta: ${data.nickname || data.email || 'OK'}` };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkStripe(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('billing_stripe_config').select('stripe_secret_key').limit(1).maybeSingle();
  const key = data?.stripe_secret_key || Deno.env.get('STRIPE_SECRET_KEY');
  
  if (!key) return { status: 'warning', message: 'Stripe não configurado no CRM.' };
  
  try {
    const res = await withTimeout(fetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${key}` }
    }), 8000, 'Stripe');
    if (!res.ok) return { status: 'offline', message: `Chave inválida ou erro HTTP ${res.status}.` };
    return { status: 'online', message: 'Conexão validada com Stripe.' };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkSerper(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('lead_hunter_config').select('config_value').eq('config_key', 'serp_api_key').maybeSingle();
  const key = data?.config_value || Deno.env.get('SERPER_API_KEY');
  
  if (!key) return { status: 'warning', message: 'Serper API não configurada no Lead Hunter.' };
  
  try {
    // Usando serpapi.com conforme verificado manualmente (a chave do usuário é da SerpApi)
    const res = await withTimeout(fetch(`https://serpapi.com/search.json?engine=google&q=health+check&api_key=${key}`), 8000, 'SerpApi');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { status: 'offline', message: `Chave inválida ou erro HTTP ${res.status}: ${data.error || 'Unauthorized'}` };
    
    const credits = data.search_metadata?.remaining_searches || data.search_metadata?.total_searches_left;
    return { status: 'online', message: `Conectado OK${credits ? ` • Créditos: ${credits}` : ''}.`, details: { credits } };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkGmail(supabase: any): Promise<CheckResult> {
  const { data: billing } = await supabase.from('billing_config').select('config_key, config_value').in('config_key', ['billing_gmail_user', 'billing_gmail_password']);
  
  const user = billing?.find((c: any) => c.config_key === 'billing_gmail_user')?.config_value || Deno.env.get('GMAIL_USER');
  const pass = billing?.find((c: any) => c.config_key === 'billing_gmail_password')?.config_value || Deno.env.get('GMAIL_APP_PASSWORD');
  
  if (!user || !pass) return { status: 'warning', message: 'Gmail não configurado no CRM.' };
  return { status: 'online', message: `Configurado para ${user}.` };
}

async function checkGoogleCalendar(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('calendar_config').select('config_key, config_value');
  
  const clientId = data?.find((c: any) => c.config_key === 'google_client_id')?.config_value;
  const clientSecret = data?.find((c: any) => c.config_key === 'google_client_secret')?.config_value;
  const refreshToken = data?.find((c: any) => c.config_key === 'google_refresh_token')?.config_value;

  if (!clientId || !clientSecret || !refreshToken) {
    return { status: 'warning', message: 'Google Calendar (Agenda) não configurado no CRM.' };
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
      return { status: 'offline', message: `Erro na Agenda: ${errorData.error_description || errorData.error || 'Token inválido'}` };
    }

    return { status: 'online', message: 'Credenciais da Agenda validadas com sucesso.' };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkWhatsAppOfficial(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('meta_credentials').select('access_token, phone_number_id').limit(1).maybeSingle();
  const token = data?.access_token;
  const phoneId = data?.phone_number_id;
  
  if (!token) return { status: 'warning', message: 'WhatsApp Cloud API não configurada na tabela meta_credentials.' };
  
  try {
    const url = phoneId 
      ? `https://graph.facebook.com/v21.0/${phoneId}?access_token=${token}`
      : `https://graph.facebook.com/v21.0/me?access_token=${token}`;
      
    const res = await withTimeout(fetch(url), 8000, 'WhatsAppMeta');
    const responseData = await res.json();
    
    if (!res.ok) {
      return { 
        status: 'offline', 
        message: `Erro na Meta: ${responseData.error?.message || `HTTP ${res.status}`}` 
      };
    }
    
    return { 
      status: 'online', 
      message: `Conectado: ${responseData.display_phone_number || responseData.name || 'Conta WhatsApp Ativa'}`,
      details: { account_id: responseData.id }
    };
  } catch (e: any) {
    return { status: 'offline', message: `Erro de conexão: ${e.message}` };
  }
}

async function checkInstagramAPI(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('instagram_settings').select('access_token, instagram_business_account_id').limit(1).maybeSingle();
  const token = data?.access_token;
  const instaId = data?.instagram_business_account_id;
  
  if (!token) return { status: 'warning', message: 'Instagram Graph API não configurada na tabela instagram_settings.' };
  
  try {
    const url = instaId 
      ? `https://graph.facebook.com/v21.0/${instaId}?fields=username,name&access_token=${token}`
      : `https://graph.facebook.com/v21.0/me?access_token=${token}`;

    const res = await withTimeout(fetch(url), 8000, 'InstagramMeta');
    const responseData = await res.json();

    if (!res.ok) {
      return { 
        status: 'offline', 
        message: `Erro na Meta: ${responseData.error?.message || `HTTP ${res.status}`}` 
      };
    }

    return { 
      status: 'online', 
      message: `Conectado: @${responseData.username || responseData.name || 'Conta Instagram Ativa'}`,
      details: { instagram_id: responseData.id }
    };
  } catch (e: any) {
    return { status: 'offline', message: `Erro de conexão: ${e.message}` };
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