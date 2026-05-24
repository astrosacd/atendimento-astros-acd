import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface Cliente {
  id: string;
  nome: string;
  email: string;
  numero: string;
  produto: string;
  plano: string | null;
  valor: number;
  moeda: string;
}

interface StripeConfig {
  stripe_secret_key: string;
  stripe_tax_percent: number;
  stripe_enabled: boolean;
}

interface PaymentResult {
  success: boolean;
  gateway: 'stripe';
  currency: 'USD';
  baseAmount: number;
  taxApplied: number;
  finalAmount: number;
  paymentLink: string | null;
  paymentId: string | null;
  status: string;
  error?: string;
}

const generateStripePaymentLink = async (
  cliente: Cliente,
  stripeConfig: StripeConfig
): Promise<PaymentResult> => {
  const baseAmount = cliente.valor;
  const taxPercent = stripeConfig.stripe_tax_percent / 100;
  const finalAmount = baseAmount / (1 - taxPercent); // Apply tax to final price
  const taxApplied = finalAmount - baseAmount;
  
  if (!stripeConfig.stripe_secret_key) {
    return {
      success: false,
      gateway: 'stripe',
      currency: 'USD',
      baseAmount,
      taxApplied: 0,
      finalAmount: baseAmount,
      paymentLink: null,
      paymentId: null,
      status: 'error',
      error: 'Stripe secret key not configured',
    };
  }

  try {
    // Create a Stripe Payment Link using the Stripe API
    const amountInCents = Math.round(finalAmount * 100);
    
    // First, create a product
    const productResponse = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name: `${cliente.produto}${cliente.plano ? ` - ${cliente.plano}` : ''}`,
        metadata: JSON.stringify({ cliente_id: cliente.id }),
      }).toString(),
    });

    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      console.error('Stripe product creation error:', errorText);
      return {
        success: false,
        gateway: 'stripe',
        currency: 'USD',
        baseAmount,
        taxApplied,
        finalAmount,
        paymentLink: null,
        paymentId: null,
        status: 'error',
        error: `Failed to create Stripe product: ${errorText}`,
      };
    }

    const product = await productResponse.json();
    console.log(`✅ Stripe product created: ${product.id}`);

    // Create a price for the product
    const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product: product.id,
        unit_amount: amountInCents.toString(),
        currency: 'usd',
      }).toString(),
    });

    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.error('Stripe price creation error:', errorText);
      return {
        success: false,
        gateway: 'stripe',
        currency: 'USD',
        baseAmount,
        taxApplied,
        finalAmount,
        paymentLink: null,
        paymentId: null,
        status: 'error',
        error: `Failed to create Stripe price: ${errorText}`,
      };
    }

    const price = await priceResponse.json();
    console.log(`✅ Stripe price created: ${price.id}`);

    // Create a payment link
    const paymentLinkResponse = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price]': price.id,
        'line_items[0][quantity]': '1',
        'metadata[cliente_id]': cliente.id,
        'metadata[cliente_nome]': cliente.nome,
        'metadata[produto]': cliente.produto,
      }).toString(),
    });

    if (!paymentLinkResponse.ok) {
      const errorText = await paymentLinkResponse.text();
      console.error('Stripe payment link creation error:', errorText);
      return {
        success: false,
        gateway: 'stripe',
        currency: 'USD',
        baseAmount,
        taxApplied,
        finalAmount,
        paymentLink: null,
        paymentId: null,
        status: 'error',
        error: `Failed to create Stripe payment link: ${errorText}`,
      };
    }

    const paymentLink = await paymentLinkResponse.json();
    console.log(`✅ Stripe payment link created: ${paymentLink.url}`);

    return {
      success: true,
      gateway: 'stripe',
      currency: 'USD',
      baseAmount,
      taxApplied,
      finalAmount,
      paymentLink: paymentLink.url,
      paymentId: paymentLink.id,
      status: 'pending',
    };
  } catch (error: any) {
    console.error('Stripe API error:', error);
    return {
      success: false,
      gateway: 'stripe',
      currency: 'USD',
      baseAmount,
      taxApplied: 0,
      finalAmount: baseAmount,
      paymentLink: null,
      paymentId: null,
      status: 'error',
      error: error?.message || 'Unknown error',
    };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { clienteId } = await req.json();

    if (!clienteId) {
      return new Response(
        JSON.stringify({ error: 'clienteId is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get cliente data
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return new Response(
        JSON.stringify({ error: 'Cliente not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if cliente is USD
    if (cliente.moeda !== 'USD') {
      return new Response(
        JSON.stringify({ error: 'Stripe is only available for USD clients' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Stripe config from billing_stripe_config table
    const { data: stripeConfigData, error: configError } = await supabase
      .from('billing_stripe_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !stripeConfigData) {
      return new Response(
        JSON.stringify({ error: 'Stripe configuration not found' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stripeConfigData.stripe_enabled) {
      return new Response(
        JSON.stringify({ error: 'Stripe is not enabled' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate Stripe payment link
    const result = await generateStripePaymentLink(cliente, stripeConfigData);

    // If successful, save to client_payments
    if (result.success && result.paymentId) {
      await supabase.from('client_payments').insert({
        cliente_id: clienteId,
        payment_id: result.paymentId,
        payment_type: 'stripe_link',
        amount: result.finalAmount,
        status: 'pending',
        billing_date: cliente.data_renovacao,
      });
    }

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Billing Stripe payment error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
