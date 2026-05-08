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

async function checkEvolution(): Promise<CheckResult> {
  const url = Deno.env.get('EVOLUTION_API_URL');
  const key = Deno.env.get('EVOLUTION_API_KEY');
  if (!url || !key) return { status: 'offline', message: 'Credenciais EVOLUTION_API_URL/KEY ausentes nos Secrets.' };
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

async function checkMercadoPago(): Promise<CheckResult> {
  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!token) return { status: 'offline', message: 'MERCADOPAGO_ACCESS_TOKEN não configurado.' };
  try {
    const res = await withTimeout(fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }), 8000, 'MercadoPago');
    if (!res.ok) return { status: 'offline', message: `Token inválido/expirado (HTTP ${res.status}).` };
    const data = await res.json();
    return { status: 'online', message: `Conta: ${data.nickname || data.email || 'OK'}` };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkStripe(supabase: any): Promise<CheckResult> {
  const envKey = Deno.env.get('STRIPE_SECRET_KEY');
  let key = envKey;
  if (!key) {
    const { data } = await supabase.from('billing_stripe_config').select('stripe_secret_key').limit(1).maybeSingle();
    key = data?.stripe_secret_key;
  }
  if (!key) return { status: 'warning', message: 'Stripe não configurado (opcional).' };
  try {
    const res = await withTimeout(fetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${key}` }
    }), 8000, 'Stripe');
    if (!res.ok) return { status: 'offline', message: `Chave inválida (HTTP ${res.status}).` };
    return { status: 'online', message: 'Conexão validada com Stripe.' };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkSerper(): Promise<CheckResult> {
  const key = Deno.env.get('SERPER_API_KEY');
  if (!key) return { status: 'warning', message: 'SERPER_API_KEY não configurada (opcional p/ Lead Hunter).' };
  try {
    const res = await withTimeout(fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'health check', num: 1 })
    }), 8000, 'Serper');
    if (!res.ok) return { status: 'offline', message: `Chave inválida (HTTP ${res.status}).` };
    const credits = res.headers.get('x-ratelimit-remaining') || res.headers.get('x-credits-remaining');
    return { status: 'online', message: `Conexão OK${credits ? ` • Créditos restantes: ${credits}` : ''}.`, details: { credits } };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
  }
}

async function checkGmail(): Promise<CheckResult> {
  const user = Deno.env.get('GMAIL_USER');
  const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!user || !pass) return { status: 'warning', message: 'GMAIL_USER/APP_PASSWORD não configurados.' };
  return { status: 'online', message: `Configurado para ${user}.` };
}

async function checkGoogleCalendar(supabase: any): Promise<CheckResult> {
  // Verifica tokens OAuth de usuários
  const { data, error } = await supabase
    .from('user_google_tokens')
    .select('user_id, expires_at')
    .limit(5);
  if (error) {
    // Tabela pode não existir
    return { status: 'warning', message: 'Tokens Google não consultáveis. Verifique a integração na Agenda.' };
  }
  if (!data || data.length === 0) {
    return { status: 'warning', message: 'Nenhum usuário conectou conta Google ainda.' };
  }
  const expired = data.filter((t: any) => t.expires_at && new Date(t.expires_at) < new Date()).length;
  if (expired === data.length) return { status: 'warning', message: `Todos os ${data.length} tokens estão expirados (renovação automática deve atuar).` };
  return { status: 'online', message: `${data.length} usuário(s) conectados.` };
}

async function checkMetaWhatsapp(supabase: any): Promise<CheckResult> {
  const { data } = await supabase
    .from('billing_config')
    .select('config_value')
    .eq('config_key', 'meta_whatsapp_token')
    .maybeSingle();
  const token = data?.config_value || Deno.env.get('META_WHATSAPP_TOKEN');
  if (!token) return { status: 'warning', message: 'Token Meta WhatsApp não configurado (opcional).' };
  return { status: 'online', message: 'Token Meta presente.' };
}

async function checkManyChat(): Promise<CheckResult> {
  const key = Deno.env.get('MANYCHAT_API_KEY');
  if (!key) return { status: 'warning', message: 'ManyChat não configurado (opcional).' };
  try {
    const res = await withTimeout(fetch('https://api.manychat.com/fb/page/getInfo', {
      headers: { 'Authorization': `Bearer ${key}` }
    }), 8000, 'ManyChat');
    if (!res.ok) return { status: 'offline', message: `Chave inválida (HTTP ${res.status}).` };
    return { status: 'online', message: 'ManyChat conectado.' };
  } catch (e: any) {
    return { status: 'offline', message: e.message };
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
      meta_whatsapp: () => checkMetaWhatsapp(supabase),
      evolution_api: () => checkEvolution(),
      google_calendar: () => checkGoogleCalendar(supabase),
      mercadopago: () => checkMercadoPago(),
      stripe: () => checkStripe(supabase),
      serper_api: () => checkSerper(),
      manychat: () => checkManyChat(),
      gmail: () => checkGmail(),
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

      // Log apenas se status mudou ou se não está online
      if (!prev || prev.status !== result.status || result.status !== 'online') {
        await supabase.from('integration_logs').insert({
          integration_name: name,
          status: result.status,
          message: result.message || `Verificação automática: ${result.status}`,
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
