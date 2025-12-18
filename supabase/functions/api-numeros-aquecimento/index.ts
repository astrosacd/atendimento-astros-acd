import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface NumeroAquecimento {
  id: string;
  numero: string;
  modelo_id: string | null;
  status_id: string | null;
  ultima_atividade: string;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function formatUltimaAtividade(tipo: 'cadastro' | 'st' | 'obs' | 'st + obs'): string {
  const date = new Date().toLocaleDateString('pt-BR');
  return `${tipo} - ${date}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is required', code: 'MISSING_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: keyData, error: keyError } = await supabase
      .from('numeros_aquecimento_api_keys')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive API key', code: 'INVALID_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabase
      .from('numeros_aquecimento_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);

    // Parse URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1];
    const isHistoryEndpoint = pathParts.includes('history');

    console.log(`[API Números] ${req.method} ${url.pathname} - Key: ${keyData.nome}`);

    // GET /history/:id - Get history for a specific number
    if (req.method === 'GET' && isHistoryEndpoint) {
      const numeroId = pathParts[pathParts.length - 1];
      
      if (numeroId === 'history') {
        // Get all history
        const { data, error } = await supabase
          .from('numeros_aquecimento_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('numeros_aquecimento_history')
        .select('*')
        .eq('numero_id', numeroId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET / - List all numbers
    if (req.method === 'GET' && endpoint === 'api-numeros-aquecimento') {
      const { data, error } = await supabase
        .from('numeros_aquecimento')
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(*),
          status:numeros_aquecimento_status(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data, count: data.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /:id - Get a specific number
    if (req.method === 'GET' && endpoint !== 'api-numeros-aquecimento') {
      const { data, error } = await supabase
        .from('numeros_aquecimento')
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(*),
          status:numeros_aquecimento_status(*)
        `)
        .eq('id', endpoint)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'Number not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST / - Create a new number
    if (req.method === 'POST') {
      const body = await req.json();

      if (!body.numero) {
        return new Response(
          JSON.stringify({ error: 'numero is required', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const insertData = {
        numero: body.numero,
        modelo_id: body.modelo_id || null,
        status_id: body.status_id || null,
        observacoes: body.observacoes || null,
        ultima_atividade: formatUltimaAtividade('cadastro'),
      };

      const { data, error } = await supabase
        .from('numeros_aquecimento')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return new Response(
            JSON.stringify({ error: 'Number already exists', code: 'DUPLICATE' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw error;
      }

      // Log history
      await supabase.from('numeros_aquecimento_history').insert({
        numero_id: data.id,
        numero_valor: data.numero,
        acao: 'cadastro',
        dados_novos: data,
        usuario_email: `API: ${keyData.nome}`,
      });

      // Trigger webhooks
      await triggerWebhooks(supabase, 'numero.created', data);

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /:id - Update a number
    if (req.method === 'PUT') {
      const body = await req.json();
      const numeroId = endpoint;

      // Get current data
      const { data: currentData, error: fetchError } = await supabase
        .from('numeros_aquecimento')
        .select('*')
        .eq('id', numeroId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentData) {
        return new Response(
          JSON.stringify({ error: 'Number not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine what changed
      const changedFields: string[] = [];
      const statusChanged = body.status_id !== undefined && body.status_id !== currentData.status_id;
      const obsChanged = body.observacoes !== undefined && body.observacoes !== currentData.observacoes;
      const modeloChanged = body.modelo_id !== undefined && body.modelo_id !== currentData.modelo_id;

      if (statusChanged) changedFields.push('status');
      if (obsChanged) changedFields.push('observacoes');
      if (modeloChanged) changedFields.push('modelo');

      // Determine ultima_atividade type
      let tipo: 'st' | 'obs' | 'st + obs' = 'obs';
      if (statusChanged && obsChanged) {
        tipo = 'st + obs';
      } else if (statusChanged) {
        tipo = 'st';
      } else if (obsChanged) {
        tipo = 'obs';
      }

      const updateData: Record<string, unknown> = {
        ultima_atividade: formatUltimaAtividade(tipo),
      };
      if (body.numero !== undefined) updateData.numero = body.numero;
      if (body.modelo_id !== undefined) updateData.modelo_id = body.modelo_id;
      if (body.status_id !== undefined) updateData.status_id = body.status_id;
      if (body.observacoes !== undefined) updateData.observacoes = body.observacoes;

      const { data, error } = await supabase
        .from('numeros_aquecimento')
        .update(updateData)
        .eq('id', numeroId)
        .select()
        .single();

      if (error) throw error;

      // Log history
      await supabase.from('numeros_aquecimento_history').insert({
        numero_id: data.id,
        numero_valor: data.numero,
        acao: 'edicao',
        dados_anteriores: currentData,
        dados_novos: data,
        campos_alterados: changedFields,
        usuario_email: `API: ${keyData.nome}`,
      });

      // Trigger webhooks
      if (statusChanged) {
        await triggerWebhooks(supabase, 'numero.status_updated', data);
      }
      if (obsChanged) {
        await triggerWebhooks(supabase, 'numero.obs_updated', data);
      }
      await triggerWebhooks(supabase, 'numero.updated', data);

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /:id - Delete a number
    if (req.method === 'DELETE') {
      const numeroId = endpoint;

      // Get current data
      const { data: currentData, error: fetchError } = await supabase
        .from('numeros_aquecimento')
        .select('*')
        .eq('id', numeroId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentData) {
        return new Response(
          JSON.stringify({ error: 'Number not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log history before deletion
      await supabase.from('numeros_aquecimento_history').insert({
        numero_id: currentData.id,
        numero_valor: currentData.numero,
        acao: 'exclusao',
        dados_anteriores: currentData,
        usuario_email: `API: ${keyData.nome}`,
      });

      const { error } = await supabase
        .from('numeros_aquecimento')
        .delete()
        .eq('id', numeroId);

      if (error) throw error;

      // Trigger webhooks
      await triggerWebhooks(supabase, 'numero.deleted', currentData);

      return new Response(
        JSON.stringify({ success: true, message: 'Number deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[API Números] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage, 
        code: 'INTERNAL_ERROR' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function triggerWebhooks(supabase: any, event: string, data: any) {
  try {
    const { data: webhooks } = await supabase
      .from('numeros_aquecimento_webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('eventos', [event]);

    if (!webhooks || webhooks.length === 0) return;

    for (const webhook of webhooks) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.secret_key ? { 'X-Webhook-Secret': webhook.secret_key } : {}),
          },
          body: JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
          }),
        });
        console.log(`[Webhook] Sent ${event} to ${webhook.nome}`);
      } catch (err) {
        console.error(`[Webhook] Failed to send to ${webhook.nome}:`, err);
      }
    }
  } catch (err) {
    console.error('[Webhook] Error fetching webhooks:', err);
  }
}
