import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const linkId = body.link_id as string | undefined;
    const mpPaymentId = body.mp_payment_id as string | undefined;

    // Get MP access token
    const { data: configRow } = await supabase
      .from("billing_config")
      .select("config_value")
      .eq("config_key", "mp_access_token")
      .single();

    if (!configRow?.config_value) {
      return new Response(JSON.stringify({ error: "Mercado Pago não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpAccessToken = configRow.config_value;

    // If mp_payment_id provided directly, just query it
    if (mpPaymentId) {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      if (!mpRes.ok) {
        return new Response(JSON.stringify({ error: "Pagamento não encontrado no Mercado Pago" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mpData = await mpRes.json();
      return new Response(JSON.stringify({
        payment_id: mpData.id,
        status: mpData.status,
        status_detail: mpData.status_detail,
        amount: mpData.transaction_amount,
        date_approved: mpData.date_approved,
        date_created: mpData.date_created,
        payer_email: mpData.payer?.email,
        payment_method: mpData.payment_method_id,
        description: mpData.description,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check all pending MP links or a specific one
    let query = supabase
      .from("payment_links")
      .select("*")
      .eq("provider", "mercadopago")
      .eq("status", "pending")
      .not("preference_id", "is", null);

    if (linkId) {
      query = supabase
        .from("payment_links")
        .select("*")
        .eq("id", linkId)
        .eq("provider", "mercadopago");
    }

    const { data: links, error: linksError } = await query;
    if (linksError) throw linksError;

    const results: Array<{
      link_id: string;
      empresa: string;
      old_status: string;
      new_status: string;
      mp_payment_id: string | null;
    }> = [];

    for (const link of links || []) {
      // For each link, search payments by preference_id
      const searchRes = await fetch(
        `https://api.mercadopago.com/v1/payments/search?preference_id=${link.preference_id}&sort=date_created&criteria=desc&limit=5`,
        { headers: { Authorization: `Bearer ${mpAccessToken}` } }
      );

      if (!searchRes.ok) {
        console.error(`[check-payment-link-status] Search failed for ${link.preference_id}`);
        continue;
      }

      const searchData = await searchRes.json();
      const payments = searchData.results || [];
      
      // Find the first approved payment
      const approvedPayment = payments.find((p: any) => p.status === "approved");
      const isExpired = new Date(link.expires_at) < new Date();

      if (approvedPayment) {
        // Mark as paid
        await supabase.from("payment_links").update({
          status: "paid",
          mp_payment_id: String(approvedPayment.id),
          paid_at: approvedPayment.date_approved || new Date().toISOString(),
        }).eq("id", link.id);

        results.push({
          link_id: link.id,
          empresa: link.empresa,
          old_status: link.status,
          new_status: "paid",
          mp_payment_id: String(approvedPayment.id),
        });
      } else if (isExpired && link.status === "pending") {
        // Mark expired links
        await supabase.from("payment_links").update({
          status: "expired",
        }).eq("id", link.id);

        results.push({
          link_id: link.id,
          empresa: link.empresa,
          old_status: link.status,
          new_status: "expired",
          mp_payment_id: null,
        });
      }
    }

    return new Response(JSON.stringify({
      checked: (links || []).length,
      updated: results.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-payment-link-status] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
