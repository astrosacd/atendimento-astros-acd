import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to add 1 month to a date
function addOneMonth(dateStr: string): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Update client renewal date when payment is confirmed
async function updateClientRenewalDate(supabase: any, clienteId: string) {
  if (!clienteId) return;
  
  try {
    // Get current client data
    const { data: cliente, error: fetchError } = await supabase
      .from('clientes')
      .select('data_renovacao')
      .eq('id', clienteId)
      .single();
    
    if (fetchError || !cliente) {
      console.error('Error fetching client for renewal update:', fetchError);
      return;
    }
    
    // Calculate new renewal date (current + 1 month)
    const newRenewalDate = addOneMonth(cliente.data_renovacao);
    
    // Update the client - the trigger will recalculate D-3, D+1, D+2, D+15, D+30
    const { error: updateError } = await supabase
      .from('clientes')
      .update({ data_renovacao: newRenewalDate })
      .eq('id', clienteId);
    
    if (updateError) {
      console.error('Error updating client renewal date:', updateError);
    } else {
      console.log(`Client ${clienteId} renewal date updated to ${newRenewalDate}`);
    }
  } catch (err) {
    console.error('Error in updateClientRenewalDate:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mercadoPagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

    if (!mercadoPagoToken) {
      console.log('MERCADOPAGO_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Mercado Pago not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending payments
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('client_payments')
      .select('*')
      .eq('status', 'pending');

    if (fetchError) {
      console.error('Error fetching pending payments:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingPayments?.length || 0} pending payments to check`);

    const results = {
      checked: 0,
      updated: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const payment of pendingPayments || []) {
      results.checked++;
      
      try {
        // Check payment status via Mercado Pago API
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${payment.payment_id}`,
          {
            headers: {
              'Authorization': `Bearer ${mercadoPagoToken}`,
            },
          }
        );

        if (mpResponse.ok) {
          const mpData = await mpResponse.json();
          console.log(`Payment ${payment.payment_id} status: ${mpData.status}`);

          // Map Mercado Pago status to our status
          let newStatus = payment.status;
          let paidAt = null;

          if (mpData.status === 'approved') {
            newStatus = 'paid';
            paidAt = mpData.date_approved || new Date().toISOString();
          } else if (mpData.status === 'rejected' || mpData.status === 'cancelled') {
            newStatus = mpData.status;
          } else if (mpData.status === 'in_process' || mpData.status === 'pending') {
            newStatus = 'pending';
          }

          if (newStatus !== payment.status) {
            const { error: updateError } = await supabase
              .from('client_payments')
              .update({
                status: newStatus,
                paid_at: paidAt,
                updated_at: new Date().toISOString()
              })
              .eq('id', payment.id);

            if (updateError) {
              console.error(`Error updating payment ${payment.id}:`, updateError);
              results.errors++;
            } else {
              results.updated++;
              results.details.push({
                payment_id: payment.payment_id,
                old_status: payment.status,
                new_status: newStatus,
                cliente_id: payment.cliente_id
              });
              
              // If payment was approved, update client renewal date
              if (newStatus === 'paid' && payment.cliente_id) {
                await updateClientRenewalDate(supabase, payment.cliente_id);
              }
            }
          }
        } else if (mpResponse.status === 404) {
          // Payment not found - might be a preference, try checking by preference
          if (payment.preference_id) {
            const searchResponse = await fetch(
              `https://api.mercadopago.com/v1/payments/search?external_reference=${payment.preference_id}`,
              {
                headers: {
                  'Authorization': `Bearer ${mercadoPagoToken}`,
                },
              }
            );

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const foundPayment = searchData.results?.[0];

              if (foundPayment) {
                let newStatus = payment.status;
                let paidAt = null;

                if (foundPayment.status === 'approved') {
                  newStatus = 'paid';
                  paidAt = foundPayment.date_approved || new Date().toISOString();
                }

                if (newStatus !== payment.status) {
                  const { error: updateError } = await supabase
                    .from('client_payments')
                    .update({
                      status: newStatus,
                      paid_at: paidAt,
                      payment_id: foundPayment.id.toString(),
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', payment.id);

                  if (!updateError) {
                    results.updated++;
                    results.details.push({
                      payment_id: foundPayment.id,
                      old_status: payment.status,
                      new_status: newStatus,
                      cliente_id: payment.cliente_id
                    });
                    
                    // If payment was approved, update client renewal date
                    if (newStatus === 'paid' && payment.cliente_id) {
                      await updateClientRenewalDate(supabase, payment.cliente_id);
                    }
                  }
                }
              }
            }
          }
        } else {
          console.error(`MP API error for payment ${payment.payment_id}: ${mpResponse.status}`);
          results.errors++;
        }
      } catch (err) {
        console.error(`Error checking payment ${payment.payment_id}:`, err);
        results.errors++;
      }
    }

    console.log('Payment status check completed:', results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-payment-status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
