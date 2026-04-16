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
      return new Response(JSON.stringify({ ok: true, message: "MP token not configured, skipping" }), {
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
      return new Response(JSON.stringify({ ok: true, message: "MP API query failed, will retry" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = await mpResponse.json();
    const mpStatus = mpData.status; // approved, pending, rejected, etc.
    const preferenceId = mpData.preference_id;
    const externalReference = mpData.external_reference;

    console.log(`[payment-link-webhook] Payment ${paymentId} status: ${mpStatus}, preference: ${preferenceId}, external_ref: ${externalReference}`);

    // Try to find the payment link by preference_id or external_reference
    const newStatus = mpStatus === "approved" ? "paid" : mpStatus === "rejected" ? "rejected" : "pending";
    const updatePayload: any = {
      mp_payment_id: paymentId,
      status: newStatus,
      paid_at: mpStatus === "approved" ? new Date().toISOString() : null,
    };

    let updated = false;

    // Match by preference_id first (most reliable for MP)
    if (preferenceId) {
      const { data, error } = await supabase
        .from("payment_links")
        .update(updatePayload)
        .eq("preference_id", String(preferenceId))
        .eq("provider", "mercadopago")
        .select("id, empresa")
        .maybeSingle();

      if (!error && data) {
        console.log(`[payment-link-webhook] Updated link "${data.empresa}" to ${newStatus}`);
        updated = true;
      }
    }

    // Fallback: match by external_reference
    if (!updated && externalReference) {
      const { data, error } = await supabase
        .from("payment_links")
        .update(updatePayload)
        .eq("external_reference", String(externalReference))
        .select("id, empresa")
        .maybeSingle();

      if (!error && data) {
        console.log(`[payment-link-webhook] Updated link "${data.empresa}" via external_reference to ${newStatus}`);
        updated = true;
      }
    }

    if (!updated) {
      console.log(`[payment-link-webhook] No matching link found`);
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      payment_id: paymentId,
      status: mpStatus,
      updated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[payment-link-webhook] Error:", error);
    // Always return 200 to MP so it doesn't retry indefinitely
    return new Response(JSON.stringify({ ok: true, message: "Internal error but acknowledged" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
