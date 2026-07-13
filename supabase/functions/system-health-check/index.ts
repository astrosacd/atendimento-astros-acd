import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const baseCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Access-Control-Request-Headers',
}

function getCorsHeaders(req: Request) {
  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers')
      || 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
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
  
  if (!phoneId) {
    await supabase.from('api_quotas').delete().eq('api_name', 'meta_whatsapp');
    return { status: 'warning', message: 'Phone Number ID não configurado (necessário para limites reais).' };
  }
  
  try {
    const url = `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,messaging_limit_tier,quality_rating&access_token=${token}`;
    const res = await withTimeout(fetch(url), 8000, 'WhatsAppMeta');
    const responseData = await res.json();
    
    if (!res.ok) {
      await supabase.from('api_quotas').delete().eq('api_name', 'meta_whatsapp');
      return { 
        status: 'offline', 
        message: `Token rejeitado pela Meta: ${responseData.error?.message || `Erro HTTP ${res.status}`}` 
      };
    }
    
    const tierMap: Record<string, number> = {
      'TIER_50': 50, 'TIER_250': 250, 'TIER_1K': 1000,
      'TIER_10K': 10000, 'TIER_100K': 100000, 'TIER_UNLIMITED': 999999,
    };
    const tier = responseData.messaging_limit_tier as string | undefined;
    const maxConversations = tier ? (tierMap[tier] ?? 0) : 0;
    
    if (tier) {
      await supabase.from('api_quotas').upsert({
        api_name: 'meta_whatsapp',
        display_name: 'WhatsApp Cloud (Conversas/24h)',
        current_value: maxConversations,
        max_value: maxConversations,
        limit_type: 'conversations_24h',
        last_updated: new Date().toISOString()
      }, { onConflict: 'api_name' });
    } else {
      await supabase.from('api_quotas').delete().eq('api_name', 'meta_whatsapp');
    }
    
    const tierLabel = tier ? tier.replace('TIER_', '').replace('K', ' mil').replace('UNLIMITED', 'Ilimitado') : 'N/A';
    const quality = responseData.quality_rating || 'UNKNOWN';
    
    return { 
      status: 'online', 
      message: `${responseData.display_phone_number || 'Ativo'} • Tier: ${tierLabel} conversas/24h • Qualidade: ${quality}`,
      details: { phone: responseData.display_phone_number, tier, max_conversations_24h: maxConversations, quality_rating: quality }
    };
  } catch (e: any) {
    return { status: 'offline', message: `Falha na requisição Meta: ${e.message}` };
  }
}

async function checkInstagramAPI(supabase: any): Promise<CheckResult> {
  const { data } = await supabase
    .from('instagram_settings')
    .select('access_token, instagram_business_account_id, ig_user_id, token_expires_at, account_username')
    .limit(1)
    .maybeSingle();
  const token = data?.access_token;
  const instaId = data?.instagram_business_account_id || data?.ig_user_id;
  const expiresAt = data?.token_expires_at ? new Date(data.token_expires_at) : null;

  if (!token) {
    return { status: 'warning', message: 'Sem Access Token do Instagram.' };
  }

  // Alerta se o token vai expirar em <7 dias
  if (expiresAt) {
    const msLeft = expiresAt.getTime() - Date.now();
    const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
    if (msLeft <= 0) {
      return { status: 'offline', message: `Token EXPIRADO em ${expiresAt.toISOString().slice(0,10)}. Reautorize o Instagram.` };
    }
    if (daysLeft <= 7) {
      return {
        status: 'warning',
        message: `Token expira em ${daysLeft} dia(s) (${expiresAt.toISOString().slice(0,10)}). Refresh automático em breve — se falhar, reautorize.`,
        details: { token_expires_at: expiresAt.toISOString(), days_left: daysLeft }
      };
    }
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

    const daysHint = expiresAt ? ` — expira em ${Math.floor((expiresAt.getTime() - Date.now()) / 86400000)}d` : '';
    return {
      status: 'online',
      message: `Perfil: @${responseData.username || data?.account_username || 'Ativo'}${daysHint}`,
      details: { instagram_id: responseData.id, token_expires_at: expiresAt?.toISOString() ?? null }
    };
  } catch (e: any) {
    return { status: 'offline', message: `Falha na requisição Instagram: ${e.message}` };
  }
}

async function checkBaserow(supabase: any): Promise<CheckResult> {
  const { data: configData } = await supabase.from('consulta_numeros_config').select('config_key, config_value');
  
  const url = configData?.find((c: any) => c.config_key === 'baserow_api_url')?.config_value;
  const token = configData?.find((c: any) => c.config_key === 'baserow_api_token')?.config_value;
  const tableId = configData?.find((c: any) => c.config_key === 'baserow_table_id')?.config_value;

  if (!url || !token || !tableId) return { status: 'warning', message: 'Credenciais Baserow não configuradas.' };

  try {
    const res = await withTimeout(fetch(`${url.replace(/\/$/, '')}/api/database/rows/table/${tableId}/?size=1`, {
      headers: { 'Authorization': `Token ${token}` }
    }), 8000, 'Baserow');
    
    if (!res.ok) {
      const errorText = await res.text();
      return { status: 'offline', message: `Erro Baserow (HTTP ${res.status}): ${errorText.slice(0, 50)}...` };
    }
    
    const data = await res.json();
    return { status: 'online', message: `Conectado. ${data.count || 0} registros encontrados.`, details: { count: data.count } };
  } catch (e: any) {
    return { status: 'offline', message: `Falha de conexão: ${e.message}` };
  }
}

async function checkInternalSync(supabase: any): Promise<CheckResult> {
  const { data } = await supabase.from('consulta_numeros_sync_status').select('*').limit(1).maybeSingle();
  
  if (!data) return { status: 'warning', message: 'Sincronização nunca executada.' };
  
  const lastSync = new Date(data.last_sync_at);
  const diffHours = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
  
  if (data.last_sync_status !== 'success') {
    return { status: 'offline', message: `Última sincronização falhou: ${data.error_message || 'Erro desconhecido'}` };
  }
  
  if (diffHours > 24) {
    return { status: 'warning', message: `Sincronização atrasada (${Math.round(diffHours)}h atrás).` };
  }
  
  return { status: 'online', message: `Sincronização OK (${data.rows_synced} registros sincronizados).` };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const checks: Record<string, { fn: (supabase: any) => Promise<CheckResult>, display: string, category: string }> = {
      system_integrity: { fn: async (sb) => {
        const { count, error } = await sb.from('integration_logs').select('*', { count: 'exact', head: true }).eq('status', 'offline').gt('created_at', new Date(Date.now() - 3600000).toISOString());
        if (error) return { status: 'offline', message: `Erro ao consultar logs: ${error.message}` };
        return { 
          status: count > 0 ? 'warning' : 'online', 
          message: count > 0 ? `${count} falhas críticas na última hora.` : 'Nenhuma falha crítica detectada recentemente.',
          details: { critical_errors_1h: count }
        };
      }, display: 'Integridade Geral', category: 'sistema' },
      whatsapp_official: { fn: checkWhatsAppOfficial, display: 'WhatsApp Cloud API', category: 'meta' },
      instagram_api: { fn: checkInstagramAPI, display: 'Instagram Graph API', category: 'meta' },
      baserow_api: { fn: checkBaserow, display: 'Baserow (Consulta Números)', category: 'banco de dados' },
      sync_status: { fn: checkInternalSync, display: 'Sincronização Interna', category: 'sistema' },
      evolution_api: { fn: checkEvolution, display: 'Evolution API (Disparos)', category: 'whatsapp' },
      google_calendar: { fn: checkGoogleCalendar, display: 'Google Calendar (Agenda)', category: 'google' },
      mercadopago: { fn: checkMercadoPago, display: 'Mercado Pago (Checkout)', category: 'financeiro' },
      stripe: { fn: checkStripe, display: 'Stripe (Cartão)', category: 'financeiro' },
      serper_api: { fn: checkSerper, display: 'SerpApi (Lead Hunter)', category: 'leads' },
      gmail: { fn: checkGmail, display: 'Gmail Integration', category: 'email' },
    };

    // Obter todos os IDs atuais no banco para limpar o que não está mais na lista
    const currentKeys = Object.keys(checks);
    await supabase.from('integration_status').delete().not('integration_name', 'in', `(${currentKeys.join(',')})`);

    const results: any[] = [];
    for (const [name, config] of Object.entries(checks)) {
      const start = Date.now();
      let result: CheckResult;
      try {
        result = await config.fn(supabase);
      } catch (e: any) {
        result = { status: 'offline', message: `Erro fatal: ${e.message}` };
      }
      const responseTime = Date.now() - start;

      // Upsert status
      await supabase
        .from('integration_status')
        .upsert({
          integration_name: name,
          display_name: config.display,
          category: config.category,
          status: result.status,
          error_message: result.status === 'online' ? null : result.message,
          response_time_ms: responseTime,
          last_check: new Date().toISOString(),
          metadata: result.details || {},
        }, { onConflict: 'integration_name' });

      // Só logar se houver erro ou mudança significativa
      if (result.status !== 'online') {
        await supabase.from('integration_logs').insert({
          integration_name: name,
          status: result.status,
          message: result.message || `Verificação retornou ${result.status}`,
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