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

    // Mercado Pago sends IPN notifications as query params or body
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const resourceId = url.searchParams.get("id") || url.searchParams.get("data.id");

    let paymentId: string | null = null;

    if (topic === "payment" && resourceId) {
      paymentId = resourceId;
    } else {
      // Try to read from body (webhook v2 format)
      try {
        const body = await req.json();
        if (body.type === "payment" && body.data?.id) {
          paymentId = String(body.data.id);
        } else if (body.action === "payment.updated" || body.action === "payment.created") {
          paymentId = String(body.data?.id);
        }
      } catch {
        // No body or invalid JSON
      }
    }

    if (!paymentId) {
      console.log("[payment-link-webhook] No payment ID found, ignoring");
      return new Response(JSON.stringify({ ok: true, message: "Ignored - no payment ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[payment-link-webhook] Processing payment ID: ${paymentId}`);

    // Get MP access token from billing config
    const { data: configRows } = await supabase
      .from("billing_config")
      .select("config_value")
      .eq("config_key", "mp_access_token")
      .single();

    if (!configRows?.config_value) {
      console.error("[payment-link-webhook] No MP access token configured");
      return new Response(JSON.stringify({ error: "MP token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query Mercado Pago API for payment details
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configRows.config_value}`,
      },
    });

    if (!mpResponse.ok) {
      const errText = await mpResponse.text();
      console.error(`[payment-link-webhook] MP API error [${mpResponse.status}]:`, errText);
      return new Response(JSON.stringify({ error: "Failed to query MP API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = await mpResponse.json();
    const mpStatus = mpData.status; // approved, pending, rejected, etc.
    const preferenceId = mpData.preference_id || mpData.collector?.id;
    const externalReference = mpData.external_reference;

    console.log(`[payment-link-webhook] Payment ${paymentId} status: ${mpStatus}, preference: ${preferenceId}`);

    // Try to find the payment link by preference_id
    let updateQuery = supabase
      .from("payment_links")
      .update({
        mp_payment_id: paymentId,
        status: mpStatus === "approved" ? "paid" : mpStatus === "rejected" ? "rejected" : "pending",
        paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
      });

    // Match by preference_id (most reliable)
    if (preferenceId) {
      const { data: updated, error } = await updateQuery
        .eq("preference_id", String(preferenceId))
        .eq("provider", "mercadopago")
        .select("id, empresa")
        .maybeSingle();

      if (error) {
        console.error("[payment-link-webhook] Update error:", error);
      } else if (updated) {
        console.log(`[payment-link-webhook] Updated link "${updated.empresa}" to ${mpStatus}`);
      } else {
        console.log(`[payment-link-webhook] No link found for preference ${preferenceId}`);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      payment_id: paymentId,
      status: mpStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[payment-link-webhook] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
