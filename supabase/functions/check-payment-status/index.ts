import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-temp-access-token',
};

// Helper function to add 1 month to a date
function addOneMonth(dateStr: string): string {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

function getStripeAuthHeader(secretKey: string): string {
  const normalizedKey = secretKey.replace(/^Bearer\s+/i, '').trim();
  return `Basic ${btoa(`${normalizedKey}:`)}`;
}

async function stripeGet(stripeSecretKey: string, path: string, params?: Record<string, string | number>) {
  const query = params ? `?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString()}` : '';
  const response = await fetch(`https://api.stripe.com/v1/${path}${query}`, {
    headers: { Authorization: getStripeAuthHeader(stripeSecretKey) },
  });

  if (!response.ok) {
    console.error(`Stripe API error for ${path}: ${response.status}`);
    return null;
  }

  return response.json();
}

// Update client renewal date when payment is confirmed
async function updateClientRenewalDate(supabase: any, clienteId: string) {
  if (!clienteId) return;
  
  try {
    const { data: cliente, error: fetchError } = await supabase
      .from('clientes')
      .select('data_renovacao')
      .eq('id', clienteId)
      .single();
    
    if (fetchError || !cliente) {
      console.error('Error fetching client for renewal update:', fetchError);
      return;
    }
    
    const newRenewalDate = addOneMonth(cliente.data_renovacao);
    
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

// Check Stripe payment status
async function checkStripePayment(stripeSecretKey: string, payment: any, supabase: any, results: any) {
  try {
    // payment_id for Stripe is the PaymentIntent ID (starts with pi_) or Session ID (starts with cs_)
    const paymentId = payment.payment_id;
    
    let newStatus = payment.status;
    let paidAt = null;
    
    if (paymentId.startsWith('pi_')) {
      // It's a PaymentIntent
      const paymentIntent = await stripeGet(stripeSecretKey, `payment_intents/${paymentId}`);
      if (!paymentIntent) {
        results.errors++;
        return;
      }
      console.log(`Stripe PaymentIntent ${paymentId} status: ${paymentIntent.status}`);
      
      if (paymentIntent.status === 'succeeded') {
        newStatus = 'paid';
        paidAt = new Date(paymentIntent.created * 1000).toISOString();
      } else if (paymentIntent.status === 'canceled') {
        newStatus = 'cancelled';
      }
    } else if (paymentId.startsWith('cs_')) {
      // It's a Checkout Session
      const session = await stripeGet(stripeSecretKey, `checkout/sessions/${paymentId}`);
      if (!session) {
        results.errors++;
        return;
      }
      console.log(`Stripe Session ${paymentId} status: ${session.payment_status}`);
      
      if (session.payment_status === 'paid') {
        newStatus = 'paid';
        paidAt = new Date().toISOString();
      } else if (session.status === 'expired') {
        newStatus = 'cancelled';
      }
    } else {
      // Try to search by payment ID in metadata
      const paymentIntents = await stripeGet(stripeSecretKey, 'payment_intents/search', {
        query: `metadata['payment_id']:'${paymentId}'`,
        limit: 1,
      });
      
      if (paymentIntents?.data?.length > 0) {
        const pi = paymentIntents.data[0];
        console.log(`Stripe PaymentIntent found via search, status: ${pi.status}`);
        
        if (pi.status === 'succeeded') {
          newStatus = 'paid';
          paidAt = new Date(pi.created * 1000).toISOString();
        } else if (pi.status === 'canceled') {
          newStatus = 'cancelled';
        }
      }
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
        console.error(`Error updating Stripe payment ${payment.id}:`, updateError);
        results.errors++;
      } else {
        results.updated++;
        results.details.push({
          payment_id: payment.payment_id,
          old_status: payment.status,
          new_status: newStatus,
          cliente_id: payment.cliente_id,
          gateway: 'stripe'
        });
        
        if (newStatus === 'paid' && payment.cliente_id) {
          await updateClientRenewalDate(supabase, payment.cliente_id);
        }
      }
    }
  } catch (err) {
    console.error(`Error checking Stripe payment ${payment.payment_id}:`, err);
    results.errors++;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Stripe config from database
    const { data: stripeConfig } = await supabase
      .from('billing_stripe_config')
      .select('stripe_enabled, stripe_secret_key')
      .single();
    
    const stripeEnabled = stripeConfig?.stripe_enabled && stripeConfig?.stripe_secret_key;
    let stripe: Stripe | null = null;
    
    if (stripeEnabled) {
      stripe = new Stripe(stripeConfig.stripe_secret_key, {
        apiVersion: '2023-10-16',
      });
      console.log('Stripe verification enabled');
    }

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
      details: [] as any[],
      mercadoPagoChecked: 0,
      stripeChecked: 0
    };

    // Process a single payment (Stripe or Mercado Pago)
    const processPayment = async (payment: any) => {
      const isStripePayment = payment.payment_type?.toLowerCase().includes('stripe');

      if (isStripePayment) {
        results.stripeChecked++;
        if (stripe) {
          await checkStripePayment(stripe, payment, supabase, results);
        } else {
          console.log(`Stripe payment ${payment.payment_id} skipped - Stripe not configured`);
        }
        return;
      }

      results.mercadoPagoChecked++;

      if (!mercadoPagoToken) {
        console.log(`MP payment ${payment.payment_id} skipped - Mercado Pago not configured`);
        return;
      }

      try {
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${payment.payment_id}`,
          { headers: { 'Authorization': `Bearer ${mercadoPagoToken}` } }
        );

        if (mpResponse.ok) {
          const mpData = await mpResponse.json();
          console.log(`Payment ${payment.payment_id} status: ${mpData.status}`);

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
                cliente_id: payment.cliente_id,
                gateway: 'mercadopago'
              });

              if (newStatus === 'paid' && payment.cliente_id) {
                await updateClientRenewalDate(supabase, payment.cliente_id);
              }
            }
          }
        } else if (mpResponse.status === 404) {
          if (payment.preference_id) {
            const searchResponse = await fetch(
              `https://api.mercadopago.com/v1/payments/search?external_reference=${payment.preference_id}`,
              { headers: { 'Authorization': `Bearer ${mercadoPagoToken}` } }
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
                      cliente_id: payment.cliente_id,
                      gateway: 'mercadopago'
                    });

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
    };

    // Process payments in parallel batches of 10 to avoid client timeout
    const BATCH_SIZE = 10;
    const allPayments = pendingPayments || [];
    results.checked = allPayments.length;

    for (let i = 0; i < allPayments.length; i += BATCH_SIZE) {
      const batch = allPayments.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(processPayment));
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
