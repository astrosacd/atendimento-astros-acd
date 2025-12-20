import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("gateway_orders")
      .select(`
        *,
        product:gateway_products(name)
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

    // Get gateway settings
    const { data: settings } = await supabase
      .from("gateway_settings")
      .select("value")
      .eq("key", "gateways")
      .single();

    const gatewaySettings = settings?.value || {};
    let redirectUrl: string | null = null;

    if (gateway === "mercadopago") {
      const mpAccessToken = gatewaySettings.mercadopago?.accessToken || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      
      if (!mpAccessToken) {
        console.error("Mercado Pago not configured");
        return new Response(
          JSON.stringify({ error: "Mercado Pago não configurado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create Mercado Pago preference
      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              title: order.product?.name || "Produto",
              quantity: 1,
              unit_price: order.total,
              currency_id: order.currency,
            },
          ],
          payer: {
            email: order.customer_email,
            name: order.customer_name,
          },
          external_reference: orderId,
          back_urls: {
            success: `${req.headers.get("origin")}/sucesso`,
            failure: `${req.headers.get("origin")}/p/${order.product?.public_slug || ""}`,
            pending: `${req.headers.get("origin")}/sucesso`,
          },
          auto_return: "approved",
          notification_url: `${supabaseUrl}/functions/v1/gateway-payment-webhook`,
        }),
      });

      const mpData = await mpResponse.json();
      
      if (!mpResponse.ok) {
        console.error("Mercado Pago error:", mpData);
        return new Response(
          JSON.stringify({ error: "Erro ao criar preferência de pagamento" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update order with preference ID
      await supabase
        .from("gateway_orders")
        .update({ payment_id: mpData.id })
        .eq("id", orderId);

      redirectUrl = mpData.init_point;
    } else if (gateway === "stripe") {
      // Stripe implementation placeholder
      // For now, just mark as pending
      console.log("Stripe payment requested for order:", orderId);
      
      return new Response(
        JSON.stringify({ error: "Stripe ainda não implementado" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Payment initiated for order ${orderId} via ${gateway}`);

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
