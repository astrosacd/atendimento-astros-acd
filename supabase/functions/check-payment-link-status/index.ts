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

    const body = await req.json().catch(() => ({}));
    const linkId = body.link_id as string | undefined;
    const mpPaymentId = body.mp_payment_id as string | undefined;
    const stripePaymentId = body.stripe_payment_id as string | undefined;
    const queryProvider = body.query_provider as string | undefined;
    const shareToken = body.share_token as string | undefined;

    // Auth: either valid JWT OR a valid share_token with allow_status_check = true
    let authorized = false;

    if (shareToken) {
      const { data: tokenData } = await supabase.rpc("validate_payment_link_token", {
        p_token: shareToken,
      });
      if (tokenData?.valid && tokenData?.allow_status_check === true) {
        // Share-token sessions can ONLY query a specific payment ID, never bulk-check all links
        if (!mpPaymentId && !stripePaymentId) {
          return new Response(JSON.stringify({ error: "Operação não permitida neste acesso temporário", not_found: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        authorized = true;
      }
    }

    if (!authorized) {
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
    }

    // Get MP access token (maybeSingle so missing row doesn't throw)
    const { data: configRow } = await supabase
      .from("billing_config")
      .select("config_value")
      .eq("config_key", "mp_access_token")
      .maybeSingle();

    // Get Stripe secret key (maybeSingle so missing row doesn't throw)
    const { data: stripeConfig } = await supabase
      .from("billing_stripe_config")
      .select("stripe_secret_key, stripe_enabled")
      .limit(1)
      .maybeSingle();

    const mpAccessToken = configRow?.config_value || "";
    const stripeSecretKey = stripeConfig?.stripe_secret_key || "";

    // ===== Query a specific MP payment ID =====
    if (mpPaymentId) {
      if (!mpAccessToken) {
        return new Response(JSON.stringify({ error: "Mercado Pago ainda não está configurado no sistema. Entre em contato com o administrador.", not_found: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      if (!mpRes.ok) {
        const errorMsg = mpRes.status === 404
          ? `Nenhum pagamento encontrado com o ID "${mpPaymentId}" no Mercado Pago. Verifique se o código está correto.`
          : `Não foi possível consultar este pagamento no Mercado Pago (erro ${mpRes.status}). Verifique o ID e tente novamente.`;
        return new Response(JSON.stringify({ error: errorMsg, not_found: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const mpData = await mpRes.json();
      return new Response(JSON.stringify({
        provider: "mercadopago",
        payment_id: mpData.id,
        status: mpData.status,
        status_detail: mpData.status_detail,
        amount: mpData.transaction_amount,
        currency: mpData.currency_id || "BRL",
        date_approved: mpData.date_approved,
        date_created: mpData.date_created,
        payer_email: mpData.payer?.email,
        payment_method: mpData.payment_method_id,
        description: mpData.description,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Query a specific Stripe payment/session ID =====
    if (stripePaymentId) {
      if (!stripeSecretKey) {
        return new Response(JSON.stringify({ error: "Stripe ainda não está configurado no sistema. Entre em contato com o administrador.", not_found: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const normalizedKey = stripeSecretKey.replace(/^Bearer\s+/i, "").trim();
      const stripeAuth = `Basic ${btoa(`${normalizedKey}:`)}`;

      // Try as payment intent first
      let stripeRes = await fetch(`https://api.stripe.com/v1/payment_intents/${stripePaymentId}`, {
        headers: { Authorization: stripeAuth },
      });

      if (stripeRes.ok) {
        const piData = await stripeRes.json();
        return new Response(JSON.stringify({
          provider: "stripe",
          payment_id: piData.id,
          status: piData.status === "succeeded" ? "approved" : piData.status === "canceled" ? "rejected" : piData.status,
          amount: (piData.amount || 0) / 100,
          currency: (piData.currency || "usd").toUpperCase(),
          date_created: piData.created ? new Date(piData.created * 1000).toISOString() : null,
          description: piData.description,
          payment_method: piData.payment_method_types?.[0] || null,
          payer_email: piData.receipt_email,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try as checkout session
      stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${stripePaymentId}`, {
        headers: { Authorization: stripeAuth },
      });

      if (stripeRes.ok) {
        const csData = await stripeRes.json();
        return new Response(JSON.stringify({
          provider: "stripe",
          payment_id: csData.id,
          status: csData.payment_status === "paid" ? "approved" : csData.payment_status === "unpaid" ? "pending" : csData.payment_status,
          amount: (csData.amount_total || 0) / 100,
          currency: (csData.currency || "usd").toUpperCase(),
          date_created: csData.created ? new Date(csData.created * 1000).toISOString() : null,
          payer_email: csData.customer_details?.email || csData.customer_email,
          description: null,
          payment_method: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `Nenhum pagamento encontrado com o ID "${stripePaymentId}" na Stripe. Verifique se o código está correto (ex: pi_xxx ou cs_xxx).`, not_found: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Check all pending links =====
    let query = supabase
      .from("payment_links")
      .select("*")
      .eq("status", "pending");

    if (linkId) {
      query = supabase
        .from("payment_links")
        .select("*")
        .eq("id", linkId);
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
      const isExpired = new Date(link.expires_at) < new Date();

      if (link.provider === "mercadopago" && mpAccessToken && link.preference_id) {
        // Search MP payments by preference_id
        const searchRes = await fetch(
          `https://api.mercadopago.com/v1/payments/search?preference_id=${link.preference_id}&sort=date_created&criteria=desc&limit=5`,
          { headers: { Authorization: `Bearer ${mpAccessToken}` } }
        );

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const payments = searchData.results || [];
          const approvedPayment = payments.find((p: any) => p.status === "approved");

          if (approvedPayment) {
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
            continue;
          }
        }
      }

      if (link.provider === "stripe" && stripeSecretKey && link.external_reference) {
        // For Stripe payment links, list checkout sessions
        const normalizedKey = stripeSecretKey.replace(/^Bearer\s+/i, "").trim();
        const stripeAuth = `Basic ${btoa(`${normalizedKey}:`)}`;

        const sessionsRes = await fetch(
          `https://api.stripe.com/v1/checkout/sessions?payment_link=${link.external_reference}&limit=5`,
          { headers: { Authorization: stripeAuth } }
        );

        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          const paidSession = (sessionsData.data || []).find((s: any) => s.payment_status === "paid");

          if (paidSession) {
            await supabase.from("payment_links").update({
              status: "paid",
              mp_payment_id: paidSession.payment_intent || paidSession.id,
              paid_at: paidSession.created ? new Date(paidSession.created * 1000).toISOString() : new Date().toISOString(),
            }).eq("id", link.id);

            results.push({
              link_id: link.id,
              empresa: link.empresa,
              old_status: link.status,
              new_status: "paid",
              mp_payment_id: paidSession.payment_intent || paidSession.id,
            });
            continue;
          }
        }
      }

      // Mark expired
      if (isExpired && link.status === "pending") {
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
