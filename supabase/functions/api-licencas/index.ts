import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface LicencaPayload {
  cliente_cpf?: string;
  cliente_numero?: string;
  cliente_id?: string;
  ferramenta: string;
  codigo_licenca: string;
  observacao?: string;
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
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      console.log('API key missing');
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if API key is valid
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, name, is_active')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (keyError || !keyData) {
      console.log('Invalid API key:', keyError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last used
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);

    const url = new URL(req.url);
    const path = url.pathname.replace('/api-licencas', '');

    // POST /api-licencas - Register a new license
    if (req.method === 'POST' && (path === '' || path === '/')) {
      const body: LicencaPayload = await req.json();
      console.log('Registering license:', body);

      // Validate required fields
      if (!body.ferramenta || !body.codigo_licenca) {
        return new Response(
          JSON.stringify({ error: 'ferramenta and codigo_licenca are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find client by ID, CPF, or phone number
      let clienteId = body.cliente_id;
      
      if (!clienteId) {
        let query = supabase.from('clientes').select('id, nome, plano');
        
        if (body.cliente_cpf) {
          query = query.eq('cpf', body.cliente_cpf);
        } else if (body.cliente_numero) {
          // Normalize phone number
          const normalizedNumber = body.cliente_numero.replace(/\D/g, '');
          query = query.or(`numero.eq.${normalizedNumber},numero.ilike.%${normalizedNumber}%`);
        } else {
          return new Response(
            JSON.stringify({ error: 'cliente_id, cliente_cpf, or cliente_numero is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: cliente, error: clienteError } = await query.maybeSingle();
        
        if (clienteError || !cliente) {
          console.log('Client not found:', clienteError?.message);
          return new Response(
            JSON.stringify({ error: 'Client not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        clienteId = cliente.id;
      }

      // Check if license already exists for this client and tool
      const { data: existingLicense } = await supabase
        .from('licencas_entregues')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('codigo_licenca', body.codigo_licenca)
        .maybeSingle();

      if (existingLicense) {
        return new Response(
          JSON.stringify({ error: 'License already registered for this client', license_id: existingLicense.id }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert license
      const { data: license, error: insertError } = await supabase
        .from('licencas_entregues')
        .insert({
          cliente_id: clienteId,
          ferramenta: body.ferramenta,
          codigo_licenca: body.codigo_licenca,
          observacao: body.observacao || null,
          origem: 'api'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting license:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to register license', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('License registered successfully:', license.id);
      return new Response(
        JSON.stringify({ success: true, license }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-licencas?cliente_id=xxx - Get licenses for a client
    if (req.method === 'GET') {
      const clienteId = url.searchParams.get('cliente_id');
      const clienteCpf = url.searchParams.get('cliente_cpf');
      const clienteNumero = url.searchParams.get('cliente_numero');

      let query = supabase.from('licencas_entregues').select('*');

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      } else if (clienteCpf) {
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id')
          .eq('cpf', clienteCpf)
          .maybeSingle();
        
        if (!cliente) {
          return new Response(
            JSON.stringify({ error: 'Client not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        query = query.eq('cliente_id', cliente.id);
      } else if (clienteNumero) {
        const normalizedNumber = clienteNumero.replace(/\D/g, '');
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id')
          .or(`numero.eq.${normalizedNumber},numero.ilike.%${normalizedNumber}%`)
          .maybeSingle();
        
        if (!cliente) {
          return new Response(
            JSON.stringify({ error: 'Client not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        query = query.eq('cliente_id', cliente.id);
      } else {
        return new Response(
          JSON.stringify({ error: 'cliente_id, cliente_cpf, or cliente_numero is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: licenses, error } = await query.order('data_entrega', { ascending: false });

      if (error) {
        console.error('Error fetching licenses:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch licenses' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ licenses }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api-licencas/:id - Delete a license
    if (req.method === 'DELETE') {
      const licenseId = path.replace('/', '');
      
      if (!licenseId) {
        return new Response(
          JSON.stringify({ error: 'License ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('licencas_entregues')
        .delete()
        .eq('id', licenseId);

      if (error) {
        console.error('Error deleting license:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to delete license' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
