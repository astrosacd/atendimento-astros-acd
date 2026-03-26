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

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    let userEmail: string | null = null;
    let userId: string | null = null;
    let isShareToken = false;

    const body = await req.json();
    const { empresa, valor_da_venda, share_token, validade_horas } = body;

    // Auth: either JWT or valid share_token
    if (share_token) {
      const { data: isValid } = await supabase.rpc("validate_payment_link_token", {
        p_token: share_token,
      });
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Token inválido ou expirado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      isShareToken = true;
    } else if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = user.id;
      userEmail = user.email || null;
    } else {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (!empresa || typeof empresa !== "string" || empresa.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Nome da empresa é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!valor_da_venda || isNaN(parseFloat(String(valor_da_venda).replace(",", ".")))) {
      return new Response(
        JSON.stringify({ error: "Valor da venda inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valorOriginal = parseFloat(String(valor_da_venda).replace(",", "."));
    if (valorOriginal <= 0 || valorOriginal > 999999) {
      return new Response(
        JSON.stringify({ error: "Valor deve ser entre 0.01 e 999999" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate fee-adjusted value: valor / (1 - 0.0499)
    const taxaPercentual = 4.99;
    const valorComTaxa = parseFloat((valorOriginal / (1 - taxaPercentual / 100)).toFixed(2));

    // Validity in hours (default 24)
    const validadeHoras = typeof validade_horas === "number" && validade_horas > 0 && validade_horas <= 168
      ? validade_horas : 24;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validadeHoras * 60 * 60 * 1000);

    // Get Mercado Pago access token from gateway_settings
    const { data: mpSettings } = await supabase
      .from("gateway_settings")
      .select("value")
      .eq("key", "mercadopago")
      .single();

    const accessToken = mpSettings?.value?.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Token do Mercado Pago não configurado. Configure em Gateway → Configurações → Gateways." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Mercado Pago preference
    const mpBody = {
      items: [
        {
          title: empresa.trim(),
          quantity: 1,
          unit_price: valorComTaxa,
        },
      ],
      expires: true,
      expiration_date_from: now.toISOString(),
      expiration_date_to: expiresAt.toISOString(),
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(mpBody),
    });

    if (!mpResponse.ok) {
      const errText = await mpResponse.text();
      console.error("Mercado Pago error:", errText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link no Mercado Pago" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mpData = await mpResponse.json();
    const paymentUrl = mpData.init_point;
    const preferenceId = mpData.id;

    // Save to history
    await supabase.from("payment_links").insert({
      empresa: empresa.trim(),
      valor_original: valorOriginal,
      valor_com_taxa: valorComTaxa,
      taxa_percentual: taxaPercentual,
      payment_url: paymentUrl,
      preference_id: preferenceId,
      expires_at: expiresAt.toISOString(),
      created_by: userId,
      created_by_email: userEmail || (isShareToken ? "link-temporario" : null),
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        valor_original: valorOriginal,
        valor_com_taxa: valorComTaxa,
        taxa_percentual: taxaPercentual,
        expires_at: expiresAt.toISOString(),
        preference_id: preferenceId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-payment-link error:", e);
    return new Response(
      JSON.stringify({ error: "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
