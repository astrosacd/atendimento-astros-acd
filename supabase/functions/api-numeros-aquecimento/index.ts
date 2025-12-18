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

      const isUuid = (value: unknown) =>
        typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

      const resolveModeloId = async (value: unknown) => {
        if (!value) return null;
        if (isUuid(value)) return value as string;
        const { data: modelo } = await supabase
          .from('numeros_aquecimento_modelos')
          .select('id')
          .eq('nome', String(value))
          .maybeSingle();
        return modelo?.id ?? null;
      };

      const resolveStatusId = async (value: unknown) => {
        if (!value) return null;
        if (isUuid(value)) return value as string;
        const { data: status } = await supabase
          .from('numeros_aquecimento_status')
          .select('id')
          .eq('nome', String(value))
          .maybeSingle();
        return status?.id ?? null;
      };

      const ultima_atividade = formatUltimaAtividade('cadastro');

      const insertData = {
        numero: body.numero,
        modelo_id: await resolveModeloId(body.modelo_id ?? body.modelo_nome),
        status_id: await resolveStatusId(body.status_id ?? body.status_nome),
        observacoes: body.observacoes || null,
        ultima_atividade,
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

      // Fetch with full modelo and status for webhook
      const { data: enrichedData } = await supabase
        .from('numeros_aquecimento')
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(*),
          status:numeros_aquecimento_status(*)
        `)
        .eq('id', data.id)
        .single();

      // Log history
      await supabase.from('numeros_aquecimento_history').insert({
        numero_id: data.id,
        numero_valor: data.numero,
        acao: 'cadastro',
        dados_novos: data,
        usuario_email: `API REST: ${keyData.nome}`,
        campos_alterados: ['cadastro_via_api'],
      });

      // Trigger webhooks with enriched data (includes modelo and status objects)
      await triggerWebhooks(supabase, 'numero.created', enrichedData || data);

      return new Response(
        JSON.stringify({ success: true, data: enrichedData || data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /:id - Update a number
    if (req.method === 'PUT') {
      const body = await req.json();
      const numeroId = endpoint;

      const isUuid = (value: unknown) =>
        typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

      const resolveModeloId = async (value: unknown) => {
        if (value === undefined) return undefined;
        if (!value) return null;
        if (isUuid(value)) return value as string;
        const { data: modelo } = await supabase
          .from('numeros_aquecimento_modelos')
          .select('id')
          .eq('nome', String(value))
          .maybeSingle();
        return modelo?.id ?? null;
      };

      const resolveStatusId = async (value: unknown) => {
        if (value === undefined) return undefined;
        if (!value) return null;
        if (isUuid(value)) return value as string;
        const { data: status } = await supabase
          .from('numeros_aquecimento_status')
          .select('id')
          .eq('nome', String(value))
          .maybeSingle();
        return status?.id ?? null;
      };

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

      // Normalize incoming IDs (accept uuid or nome)
      const normalizedStatusId = body.status_id !== undefined
        ? await resolveStatusId(body.status_id ?? body.status_nome)
        : undefined;
      const normalizedModeloId = body.modelo_id !== undefined
        ? await resolveModeloId(body.modelo_id ?? body.modelo_nome)
        : undefined;

      // Determine what changed
      const changedFields: string[] = [];
      const statusChanged = normalizedStatusId !== undefined && normalizedStatusId !== currentData.status_id;
      const obsChanged = body.observacoes !== undefined && body.observacoes !== currentData.observacoes;
      const modeloChanged = normalizedModeloId !== undefined && normalizedModeloId !== currentData.modelo_id;

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
      if (normalizedModeloId !== undefined) updateData.modelo_id = normalizedModeloId;
      if (normalizedStatusId !== undefined) updateData.status_id = normalizedStatusId;
      if (body.observacoes !== undefined) updateData.observacoes = body.observacoes;

      const { data, error } = await supabase
        .from('numeros_aquecimento')
        .update(updateData)
        .eq('id', numeroId)
        .select()
        .single();

      if (error) throw error;

      // Fetch with full modelo and status for webhook
      const { data: enrichedData } = await supabase
        .from('numeros_aquecimento')
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(*),
          status:numeros_aquecimento_status(*)
        `)
        .eq('id', data.id)
        .single();

      // Log history
      await supabase.from('numeros_aquecimento_history').insert({
        numero_id: data.id,
        numero_valor: data.numero,
        acao: 'edicao',
        dados_anteriores: currentData,
        dados_novos: data,
        campos_alterados: [...changedFields, 'edicao_via_api'],
        usuario_email: `API REST: ${keyData.nome}`,
      });

      // Trigger webhooks with enriched data
      const webhookData = enrichedData || data;
      if (statusChanged) {
        await triggerWebhooks(supabase, 'numero.status_updated', webhookData);
      }
      if (obsChanged) {
        await triggerWebhooks(supabase, 'numero.obs_updated', webhookData);
      }
      await triggerWebhooks(supabase, 'numero.updated', webhookData);

      return new Response(
        JSON.stringify({ success: true, data: enrichedData || data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /:id - Delete a number
    if (req.method === 'DELETE') {
      const numeroId = endpoint;

      // Validate UUID format
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(numeroId);
      if (!isValidUuid || numeroId === 'api-numeros-aquecimento') {
        return new Response(
          JSON.stringify({ 
            error: 'ID do número é obrigatório na URL',
            code: 'VALIDATION_ERROR',
            campos_obrigatorios: {
              url: 'ID do número (UUID) na URL: /api-numeros-aquecimento/{id}',
              body: {
                observacao: 'Motivo/observação da exclusão (obrigatório)'
              }
            },
            exemplo: {
              url: 'DELETE /api-numeros-aquecimento/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
              body: '{ "observacao": "Número banido pelo WhatsApp" }'
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse body for observacao (deletion reason)
      let observacao = '';
      try {
        const body = await req.json();
        observacao = body.observacao || body.motivo || '';
      } catch {
        // Body parsing failed
      }

      if (!observacao) {
        return new Response(
          JSON.stringify({ 
            error: 'Observação é obrigatória para exclusão',
            code: 'VALIDATION_ERROR',
            campos_obrigatorios: {
              url: 'ID do número (UUID) na URL: /api-numeros-aquecimento/{id}',
              body: {
                observacao: 'Motivo/observação da exclusão (obrigatório)'
              }
            },
            exemplo: {
              curl: `curl -X DELETE -H "x-api-key: SUA_KEY" -H "Content-Type: application/json" -d '{"observacao": "Número banido"}' "https://udxaxemoozddkwpitngq.supabase.co/functions/v1/api-numeros-aquecimento/${numeroId}"`
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current data with full modelo and status for webhook
      const { data: currentData, error: fetchError } = await supabase
        .from('numeros_aquecimento')
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(*),
          status:numeros_aquecimento_status(*)
        `)
        .eq('id', numeroId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!currentData) {
        return new Response(
          JSON.stringify({ error: 'Número não encontrado', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dataExclusao = new Date().toISOString();

      // Log history before deletion - set numero_id to null so history persists
      await supabase.from('numeros_aquecimento_history').insert({
        numero_id: null, // Set to null so FK doesn't cascade delete
        numero_valor: currentData.numero,
        acao: 'exclusao',
        dados_anteriores: {
          ...currentData,
          observacao_exclusao: observacao,
          data_exclusao: dataExclusao,
        },
        usuario_email: `API REST: ${keyData.nome}`,
        campos_alterados: ['exclusao_via_api'],
      });

      const { error } = await supabase
        .from('numeros_aquecimento')
        .delete()
        .eq('id', numeroId);

      if (error) throw error;

      // Trigger webhooks with enriched data including deletion reason
      await triggerWebhooks(supabase, 'numero.deleted', {
        ...currentData,
        observacao_exclusao: observacao,
        data_exclusao: dataExclusao,
        origem: 'API REST',
        api_key_nome: keyData.nome,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Número excluído com sucesso',
          data: {
            id: currentData.id,
            numero: currentData.numero,
            observacao_exclusao: observacao,
            data_exclusao: dataExclusao,
            origem: 'API REST',
          }
        }),
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
        const ts = new Date().toISOString();
        const isObject = data && typeof data === 'object' && !Array.isArray(data);

        const original = (isObject ? data : { value: data }) as any;
        const modeloObj = original?.modelo ?? null;
        const statusObj = original?.status ?? null;

        // Keep the original payload in "data" but also provide a structured "numero" object
        // that includes modelo/status inside it (this is what n8n users usually inspect).
        const numeroPayload = isObject
          ? {
              ...original,
              modelo: modeloObj,
              status: statusObj,
            }
          : original;

        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.secret_key ? { 'X-Webhook-Secret': webhook.secret_key } : {}),
          },
          body: JSON.stringify({
            // Backward/forward compatible payload
            event,
            evento: event,
            timestamp: ts,

            // Original data
            data: original,

            // What n8n users usually inspect
            numero: numeroPayload,

            // Convenience fields
            modelo: modeloObj,
            status: statusObj,
            modelo_nome: modeloObj?.nome ?? null,
            status_nome: statusObj?.nome ?? null,
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
