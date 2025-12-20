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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse webhook data
    const contentType = req.headers.get("content-type") || "";
    let data: any;

    if (contentType.includes("application/json")) {
      data = await req.json();
    } else {
      const formData = await req.formData();
      data = Object.fromEntries(formData.entries());
    }

    console.log("Webhook received:", JSON.stringify(data, null, 2));

    // Get gateway settings
    const { data: settings } = await supabase
      .from("gateway_settings")
      .select("value")
      .eq("key", "gateways")
      .single();

    // Handle Mercado Pago IPN
    if (data.type === "payment" || data.topic === "payment") {
      const paymentId = data.data?.id || data.id;
      
      if (!paymentId) {
        console.log("No payment ID found in webhook");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const mpAccessToken = settings?.value?.mercadopago?.accessToken || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

      if (!mpAccessToken) {
        console.error("MP Access Token not found");
        return new Response("Config error", { status: 500, headers: corsHeaders });
      }

      // Get payment details from Mercado Pago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
        },
      });

      if (!mpResponse.ok) {
        console.error("Error fetching MP payment:", await mpResponse.text());
        return new Response("MP error", { status: 500, headers: corsHeaders });
      }

      const payment = await mpResponse.json();
      console.log("MP Payment details:", JSON.stringify(payment, null, 2));

      const orderId = payment.external_reference;
      
      if (!orderId) {
        console.log("No external_reference found");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Map MP status to our status
      let orderStatus = "pending";
      switch (payment.status) {
        case "approved":
          orderStatus = "paid";
          break;
        case "rejected":
        case "cancelled":
          orderStatus = "cancelled";
          break;
        case "pending":
        case "in_process":
          orderStatus = "pending";
          break;
      }

      // Update order
      const { error: updateError } = await supabase
        .from("gateway_orders")
        .update({
          status: orderStatus,
          payment_id: String(paymentId),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        console.error("Error updating order:", updateError);
        return new Response("DB error", { status: 500, headers: corsHeaders });
      }

      console.log(`Order ${orderId} updated to status: ${orderStatus}`);
    }

    // Handle Stripe webhook
    if (data.type?.startsWith("checkout.session") || data.type?.startsWith("payment_intent")) {
      console.log("Stripe webhook received:", data.type);
      
      // Handle checkout.session.completed
      if (data.type === "checkout.session.completed") {
        const session = data.data?.object;
        const orderId = session?.client_reference_id || session?.metadata?.order_id;
        
        if (orderId) {
          const { error: updateError } = await supabase
            .from("gateway_orders")
            .update({
              status: "paid",
              payment_id: session.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          if (updateError) {
            console.error("Error updating Stripe order:", updateError);
          } else {
            console.log(`Stripe order ${orderId} marked as paid`);
          }
        }
      }
      
      // Handle payment_intent.payment_failed
      if (data.type === "payment_intent.payment_failed") {
        const paymentIntent = data.data?.object;
        const orderId = paymentIntent?.metadata?.order_id;
        
        if (orderId) {
          await supabase
            .from("gateway_orders")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          console.log(`Stripe order ${orderId} marked as cancelled`);
        }
      }
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500, headers: corsHeaders });
  }
});
