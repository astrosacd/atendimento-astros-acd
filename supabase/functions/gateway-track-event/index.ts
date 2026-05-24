import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface TrackEventBody {
  event_type: string;
  slug?: string;
  product_id?: string;
  order_id?: string;
  order_bump_id?: string;
  coupon_code?: string;
  currency?: string;
  payment_gateway?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as TrackEventBody;

    if (!body?.event_type) {
      return new Response(
        JSON.stringify({ error: "event_type é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userAgent = req.headers.get("user-agent") || null;
    const referrer = req.headers.get("referer") || null;

    console.log(`[gateway-track-event] Tracking event: ${body.event_type}`);

    const { error } = await supabase.from("gateway_events").insert([
      {
        event_type: body.event_type,
        slug: body.slug || null,
        product_id: body.product_id || null,
        order_id: body.order_id || null,
        order_bump_id: body.order_bump_id || null,
        coupon_code: body.coupon_code || null,
        currency: body.currency || null,
        payment_gateway: body.payment_gateway || null,
        metadata: body.metadata || null,
        user_agent: userAgent,
        referrer: referrer,
      },
    ]);

    if (error) {
      console.error("[gateway-track-event] Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao registrar evento" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[gateway-track-event] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
