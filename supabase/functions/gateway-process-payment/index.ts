import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, gateway } = await req.json();

    if (!orderId || !gateway) {
      return new Response(
        JSON.stringify({ error: "orderId and gateway are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get order details (including CPF and phone for Mercado Pago)
    const { data: order, error: orderError } = await supabase
      .from("gateway_orders")
      .select(`
        *,
        product:gateway_products(name, public_slug)
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get gateway settings (stored as separate rows)
    const { data: settingsRows, error: settingsError } = await supabase
      .from("gateway_settings")
      .select("key, value")
      .in("key", ["stripe", "mercadopago"]);

    if (settingsError) {
      console.error("Settings fetch error:", settingsError);
    }

    const gatewaySettings = (settingsRows || []).reduce<Record<string, any>>((acc, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    let redirectUrl: string | null = null;
    const origin = req.headers.get("origin") || "https://udxaxemoozddkwpitngq.lovable.app";

    if (gateway === "mercadopago") {
      const mpAccessToken =
        gatewaySettings.mercadopago?.access_token ||
        gatewaySettings.mercadopago?.accessToken ||
        Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      
      if (!mpAccessToken) {
        console.error("Mercado Pago not configured");
        return new Response(
          JSON.stringify({ error: "Mercado Pago não configurado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build payer object with CPF if available
      const payer: Record<string, any> = {
        email: order.customer_email,
        name: order.customer_name,
      };

      // Add CPF to payer identification if available (improves approval rate)
      if (order.customer_cpf) {
        payer.identification = {
          type: "CPF",
          number: order.customer_cpf.replace(/\D/g, ""),
        };
      }

      // Add phone if available
      if (order.customer_phone) {
        const phoneDigits = order.customer_phone.replace(/\D/g, "");
        if (phoneDigits.length >= 10) {
          payer.phone = {
            area_code: phoneDigits.slice(0, 2),
            number: phoneDigits.slice(2),
          };
        }
      }

      // Excluded methods based on settings
      const excludedMethods = [];
      const mpConfig = gatewaySettings.mercadopago || {};
      
      if (mpConfig.immediate_payment) {
        excludedMethods.push({ id: "ticket" }); // ticket = boleto
        excludedMethods.push({ id: "atm" });
      } else {
        if (mpConfig.allow_boleto === false) excludedMethods.push({ id: "ticket" });
      }
      
      const excludedTypes = [];
      if (mpConfig.allow_credit_card === false) excludedTypes.push({ id: "credit_card" }, { id: "debit_card" });
      if (mpConfig.allow_pix === false) excludedMethods.push({ id: "pix" });

      // Create Mercado Pago preference
      const preferenceBody: any = {
        items: [
          {
            title: order.product?.name || "Produto",
            quantity: 1,
            unit_price: order.total,
            currency_id: order.currency,
          },
        ],
        payer,
        external_reference: orderId,
        back_urls: {
          success: mpConfig.success_url || `${origin}/sucesso`,
          failure: `${origin}/p/${order.product?.public_slug || ""}`,
          pending: mpConfig.success_url || `${origin}/sucesso`,
        },
        auto_return: "approved",
        notification_url: `${supabaseUrl}/functions/v1/gateway-payment-webhook`,
        statement_descriptor: mpConfig.statement_descriptor || undefined,
        payment_methods: {
          excluded_payment_methods: excludedMethods,
          excluded_payment_types: excludedTypes,
          installments: 12,
        },
      };

      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify(preferenceBody),
      });

      const mpData = await mpResponse.json();
      
      if (!mpResponse.ok) {
        console.error("Mercado Pago error:", mpData);
        return new Response(
          JSON.stringify({ error: "Erro ao criar preferência de pagamento", details: mpData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update order with preference ID
      await supabase
        .from("gateway_orders")
        .update({ payment_id: mpData.id })
        .eq("id", orderId);

      const isTestToken = typeof mpAccessToken === "string" && mpAccessToken.startsWith("TEST-");
      redirectUrl = (isTestToken && mpData.sandbox_init_point) ? mpData.sandbox_init_point : mpData.init_point;
      console.log(
        `Mercado Pago payment created for order ${orderId}, redirect: ${redirectUrl} (sandbox=${isTestToken})`,
      );

    } else if (gateway === "stripe") {
      const stripeSecretKey =
        gatewaySettings.stripe?.secret_key ||
        gatewaySettings.stripe?.secretKey ||
        Deno.env.get("STRIPE_SECRET_KEY");
      
      if (!stripeSecretKey) {
        console.error("Stripe not configured");
        return new Response(
          JSON.stringify({ error: "Stripe não configurado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create Stripe Checkout Session
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(stripeSecretKey + ":")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "payment_method_types[0]": "card",
          "line_items[0][price_data][currency]": order.currency.toLowerCase(),
          "line_items[0][price_data][product_data][name]": order.product?.name || "Produto",
          "line_items[0][price_data][unit_amount]": Math.round(order.total * 100).toString(),
          "line_items[0][quantity]": "1",
          "mode": "payment",
          "success_url": `${origin}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
          "cancel_url": `${origin}/p/${order.product?.public_slug || ""}`,
          "customer_email": order.customer_email,
          "client_reference_id": orderId,
          "metadata[order_id]": orderId,
        }),
      });

      const stripeData = await stripeResponse.json();
      
      if (!stripeResponse.ok) {
        console.error("Stripe error:", stripeData);
        return new Response(
          JSON.stringify({ error: "Erro ao criar sessão Stripe", details: stripeData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update order with session ID
      await supabase
        .from("gateway_orders")
        .update({ payment_id: stripeData.id })
        .eq("id", orderId);

      redirectUrl = stripeData.url;
      console.log(`Stripe payment created for order ${orderId}, redirect: ${redirectUrl}`);
    } else if (gateway === "pix") {
      // For manual PIX, we already have the proof and the order is created.
      // Just redirect to success page.
      redirectUrl = `${origin}/sucesso`;
      console.log(`PIX Manual payment completed for order ${orderId}`);
    }

    return new Response(
      JSON.stringify({ success: true, redirectUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
