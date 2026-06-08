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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);

    // --- STRIPE HANDLER ---
    // Stripe webhooks have an 'object' field in the root usually, or a 'type' event
    if (body.type && body.data?.object?.object === "checkout.session" || body.type?.startsWith("checkout.session")) {
      const session = body.data.object;
      const paymentStatus = session.payment_status;
      const checkoutSessionId = session.id;
      const paymentIntentId = session.payment_intent;
      const paymentLinkId = session.payment_link;
      
      console.log(`[webhook] Stripe Checkout Session: ${checkoutSessionId}, link: ${paymentLinkId}, status: ${paymentStatus}`);

      if (paymentStatus === "paid") {
        // Try to update by payment_link ID (which is stored in external_reference)
        const { error } = await supabase
          .from("payment_links")
          .update({
            status: "paid",
            mp_payment_id: paymentIntentId || checkoutSessionId,
            paid_at: new Date().toISOString(),
          })
          .eq("external_reference", paymentLinkId)
          .eq("provider", "stripe");

        if (error) console.error("[webhook] Error updating Stripe link:", error);
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- MERCADO PAGO HANDLER ---
    const topic = url.searchParams.get("topic") || url.searchParams.get("type") || body.type || body.topic;
    const resourceId = url.searchParams.get("id") || url.searchParams.get("data.id") || body.data?.id;

    let paymentId: string | null = null;

    if ((topic === "payment" || topic === "payment.updated" || topic === "payment.created") && resourceId) {
      paymentId = String(resourceId);
    }

    if (!paymentId) {
      console.log("[payment-link-webhook] No payment ID found, ignoring");
      return new Response(JSON.stringify({ ok: true, message: "Ignored - no payment ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[payment-link-webhook] Processing MP payment ID: ${paymentId}`);

    // Get MP access token
    const { data: configRows } = await supabase
      .from("billing_config")
      .select("config_value")
      .eq("config_key", "mp_access_token")
      .single();

    if (!configRows?.config_value) {
      console.error("[payment-link-webhook] No MP access token configured");
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${configRows.config_value}` },
    });

    if (!mpResponse.ok) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const mpData = await mpResponse.json();
    const mpStatus = mpData.status;
    const preferenceId = mpData.preference_id;
    const externalReference = mpData.external_reference;

    const newStatus = mpStatus === "approved" ? "paid" : mpStatus === "rejected" ? "rejected" : "pending";
    const updatePayload = {
      mp_payment_id: paymentId,
      status: newStatus,
      paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
    };

    let updated = false;
    if (preferenceId) {
      const { data } = await supabase
        .from("payment_links")
        .update(updatePayload)
        .eq("preference_id", String(preferenceId))
        .eq("provider", "mercadopago")
        .select("id")
        .maybeSingle();
      if (data) updated = true;
    }

    if (!updated && externalReference) {
      const { data } = await supabase
        .from("payment_links")
        .update(updatePayload)
        .or(`external_reference.eq.${String(externalReference)},preference_id.eq.${String(externalReference)}`)
        .select("id")
        .maybeSingle();
      if (data) updated = true;
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[payment-link-webhook] Error:", error);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }
});
