import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-temp-access-token",
};

type Provider = "mercadopago" | "stripe";

interface AuthContext {
  userId: string | null;
  userEmail: string | null;
  isShareToken: boolean;
  allowedProviders: Provider[];
}

const parseCurrency = (value: unknown) => {
  const parsed = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const calculateValueWithFee = (baseValue: number, feePercent: number) => {
  if (feePercent <= 0) return Number(baseValue.toFixed(2));
  return Number((baseValue / (1 - feePercent / 100)).toFixed(2));
};

const getBaseUrl = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (origin.includes("lovable.app")) {
    return origin;
  }
  return origin || "https://atendimento-astros-acd.lovable.app";
};

async function authenticate(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  shareToken?: string,
): Promise<AuthContext> {
  if (shareToken) {
    const { data, error } = await supabase.rpc("validate_payment_link_token", {
      p_token: shareToken,
    });

    if (error || !data?.valid) {
      throw new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedProviders = Array.isArray(data.allowed_providers)
      ? data.allowed_providers.filter((value: string): value is Provider =>
          value === "mercadopago" || value === "stripe",
        )
      : ["mercadopago", "stripe"];

    return {
      userId: null,
      userEmail: data.created_by_email || "link-temporario",
      isShareToken: true,
      allowedProviders,
    };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) {
    throw new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return {
    userId: userData.user.id,
    userEmail: userData.user.email || null,
    isShareToken: false,
    allowedProviders: ["mercadopago", "stripe"],
  };
}

async function loadBillingConfig(supabase: ReturnType<typeof createClient>) {
  const [{ data: billingRows, error: billingError }, { data: stripeRow, error: stripeError }] = await Promise.all([
    supabase
      .from("billing_config")
      .select("config_key, config_value")
      .in("config_key", [
        "mp_access_token", 
        "mp_taxa_cartao", 
        "mp_link_enabled",
        "mp_statement_descriptor",
        "mp_allow_credit_card",
        "mp_allow_pix",
        "mp_allow_boleto",
        "mp_success_url",
        "mp_immediate_payment"
      ]),
    supabase.from("billing_stripe_config").select("stripe_enabled, stripe_secret_key, stripe_tax_percent").limit(1).single(),
  ]);

  if (billingError) throw billingError;
  if (stripeError && stripeError.code !== "PGRST116") throw stripeError;

  const getConfig = (key: string) => billingRows?.find((row) => row.config_key === key)?.config_value || "";

  const mercadoPago = {
    enabled: getConfig("mp_link_enabled") === "true",
    accessToken: getConfig("mp_access_token"),
    feePercent: parseCurrency(getConfig("mp_taxa_cartao")) || 0,
    statementDescriptor: getConfig("mp_statement_descriptor"),
    allowCreditCard: getConfig("mp_allow_credit_card") !== "false",
    allowPix: getConfig("mp_allow_pix") !== "false",
    allowBoleto: getConfig("mp_allow_boleto") !== "false",
    successUrl: getConfig("mp_success_url"),
    immediatePayment: getConfig("mp_immediate_payment") === "true",
  };

  const stripe = {
    enabled: Boolean(stripeRow?.stripe_enabled),
    secretKey: stripeRow?.stripe_secret_key || "",
    feePercent: Number(stripeRow?.stripe_tax_percent || 0),
  };

  return { mercadoPago, stripe };
}

async function createMercadoPagoLink(params: {
  accessToken: string;
  empresa: string;
  baseValue: number;
  finalValue: number;
  feePercent: number;
  expiresAt: string;
  now: string;
  linkId: string;
  statementDescriptor?: string;
  allowCreditCard?: boolean;
  allowPix?: boolean;
  allowBoleto?: boolean;
  successUrl?: string;
  immediatePayment?: boolean;
}) {
  const externalReference = `PL-${params.linkId}`;
  
  const excludedMethods = [];
  if (params.immediatePayment) {
    excludedMethods.push({ id: "ticket" }); // ticket = boleto
    excludedMethods.push({ id: "atm" });
  } else {
    if (!params.allowBoleto) excludedMethods.push({ id: "ticket" });
  }
  
  const excludedTypes = [];
  if (!params.allowCreditCard) excludedTypes.push({ id: "credit_card" }, { id: "debit_card" });
  if (!params.allowPix) excludedMethods.push({ id: "pix" });

  const body: any = {
    items: [
      {
        id: params.linkId,
        title: params.empresa,
        description: `Pagamento - ${params.empresa}`,
        category_id: "services",
        quantity: 1,
        unit_price: params.finalValue,
        currency_id: "BRL",
      },
    ],
    external_reference: externalReference,
    expires: true,
    expiration_date_from: params.now,
    expiration_date_to: params.expiresAt,
    statement_descriptor: params.statementDescriptor || undefined,
    payment_methods: {
      excluded_payment_methods: excludedMethods,
      excluded_payment_types: excludedTypes,
      installments: 12,
    },
    metadata: {
      source_module: "cobranca",
      provider: "mercadopago",
      fee_percent: params.feePercent,
      original_value: params.baseValue,
    },
  };

  if (params.successUrl) {
    body.back_urls = {
      success: params.successUrl,
      pending: params.successUrl,
      failure: params.successUrl,
    };
    body.auto_return = "approved";
  }

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[generate-payment-link] Mercado Pago error:", errorText);
    throw new Error("Erro ao gerar link no Mercado Pago");
  }

  const data = await response.json();
  return {
    paymentUrl: data.init_point,
    referenceId: data.id,
    externalReference,
  };
}

async function createStripeLink(params: {
  secretKey: string;
  empresa: string;
  finalValue: number;
  requestBaseUrl: string;
  metadata: Record<string, string>;
}) {
  const amountInCents = Math.round(params.finalValue * 100);
  const normalizedSecretKey = params.secretKey.replace(/^Bearer\s+/i, "").trim();
  const stripeAuthHeader = `Basic ${btoa(`${normalizedSecretKey}:`)}`;

  const productResponse = await fetch("https://api.stripe.com/v1/products", {
    method: "POST",
    headers: {
      Authorization: stripeAuthHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      name: params.empresa,
      ...Object.fromEntries(Object.entries(params.metadata).map(([key, value]) => [`metadata[${key}]`, value])),
    }).toString(),
  });

  if (!productResponse.ok) {
    const errorText = await productResponse.text();
    console.error("[generate-payment-link] Stripe product error:", errorText);
    throw new Error("Erro ao criar produto na Stripe");
  }

  const product = await productResponse.json();

  const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
    method: "POST",
    headers: {
      Authorization: stripeAuthHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      product: product.id,
      unit_amount: String(amountInCents),
      currency: "usd",
    }).toString(),
  });

  if (!priceResponse.ok) {
    const errorText = await priceResponse.text();
    console.error("[generate-payment-link] Stripe price error:", errorText);
    throw new Error("Erro ao criar preço na Stripe");
  }

  const price = await priceResponse.json();

  const paymentLinkResponse = await fetch("https://api.stripe.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: stripeAuthHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": "1",
      ...Object.fromEntries(Object.entries(params.metadata).map(([key, value]) => [`metadata[${key}]`, value])),
    }).toString(),
  });

  if (!paymentLinkResponse.ok) {
    const errorText = await paymentLinkResponse.text();
    console.error("[generate-payment-link] Stripe payment link error:", errorText);
    throw new Error("Erro ao gerar link na Stripe");
  }

  const paymentLink = await paymentLinkResponse.json();
  return {
    paymentUrl: paymentLink.url,
    referenceId: paymentLink.id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const empresa = typeof body.empresa === "string" ? body.empresa.trim() : "";
    const provider = body.provider as Provider;
    const validadeHoras = Number(body.validade_horas);
    const shareToken = typeof body.share_token === "string" ? body.share_token : undefined;
    const valorOriginal = parseCurrency(body.valor_da_venda);

    if (!empresa) {
      return new Response(JSON.stringify({ error: "Nome da empresa é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!provider || !["mercadopago", "stripe"].includes(provider)) {
      return new Response(JSON.stringify({ error: "Selecione Mercado Pago ou Stripe" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(valorOriginal) || valorOriginal <= 0 || valorOriginal > 999999) {
      return new Response(JSON.stringify({ error: "Valor da venda inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = await authenticate(supabase, req, shareToken);
    if (!auth.allowedProviders.includes(provider)) {
      return new Response(JSON.stringify({ error: "Este link não tem acesso a esse provedor" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const billingConfig = await loadBillingConfig(supabase);
    const hours = Number.isFinite(validadeHoras) && validadeHoras > 0 && validadeHoras <= 168 ? validadeHoras : 24;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

    let feePercent = 0;
    let providerLabel = "";
    let configSource = "Módulo Cobrança";
    let paymentUrl = "";
    let referenceId: string | null = null;
    let mpExternalReference: string | null = null;

    // Generate a unique link ID for external_reference
    const linkId = crypto.randomUUID();

    if (provider === "mercadopago") {
      if (!billingConfig.mercadoPago.enabled || !billingConfig.mercadoPago.accessToken) {
        return new Response(JSON.stringify({ error: "Mercado Pago não configurado em Cobrança → Pagamentos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      feePercent = billingConfig.mercadoPago.feePercent;
      providerLabel = "Mercado Pago";

      console.log("[generate-payment-link] usando credenciais do módulo Cobrança / Mercado Pago");

      const result = await createMercadoPagoLink({
        accessToken: billingConfig.mercadoPago.accessToken,
        empresa,
        baseValue: valorOriginal,
        finalValue: calculateValueWithFee(valorOriginal, feePercent),
        feePercent,
        expiresAt,
        now: now.toISOString(),
        linkId,
        statementDescriptor: billingConfig.mercadoPago.statementDescriptor,
        allowCreditCard: billingConfig.mercadoPago.allowCreditCard,
        allowPix: billingConfig.mercadoPago.allowPix,
        allowBoleto: billingConfig.mercadoPago.allowBoleto,
        successUrl: billingConfig.mercadoPago.successUrl,
        immediatePayment: billingConfig.mercadoPago.immediatePayment,
      });

      paymentUrl = result.paymentUrl;
      referenceId = result.referenceId;
      mpExternalReference = result.externalReference;
    } else {
      if (!billingConfig.stripe.enabled || !billingConfig.stripe.secretKey) {
        return new Response(JSON.stringify({ error: "Stripe não configurada em Cobrança → Pagamentos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      feePercent = billingConfig.stripe.feePercent;
      providerLabel = "Stripe";

      console.log("[generate-payment-link] usando credenciais do módulo Cobrança / Stripe");

      const result = await createStripeLink({
        secretKey: billingConfig.stripe.secretKey,
        empresa,
        finalValue: calculateValueWithFee(valorOriginal, feePercent),
        requestBaseUrl: getBaseUrl(req),
        metadata: {
          source_module: "cobranca",
          provider: "stripe",
          original_value: valorOriginal.toFixed(2),
          fee_percent: feePercent.toFixed(2),
          created_by: auth.userEmail || "link-temporario",
        },
      });

      paymentUrl = result.paymentUrl;
      referenceId = result.referenceId;
    }

    const valorComTaxa = calculateValueWithFee(valorOriginal, feePercent);

    const { error: historyError } = await supabase.from("payment_links").insert({
      id: linkId,
      empresa,
      provider,
      provider_label: providerLabel,
      config_source: configSource,
      valor_original: valorOriginal,
      valor_com_taxa: valorComTaxa,
      taxa_percentual: feePercent,
      payment_url: paymentUrl,
      preference_id: provider === "mercadopago" ? referenceId : null,
      external_reference: provider === "mercadopago" ? mpExternalReference : referenceId,
      expires_at: expiresAt,
      created_by: auth.userId,
      created_by_email: auth.userEmail,
    });

    if (historyError) {
      console.error("[generate-payment-link] history insert error:", historyError);
    }

    return new Response(JSON.stringify({
      success: true,
      provider,
      provider_label: providerLabel,
      config_source: configSource,
      payment_url: paymentUrl,
      valor_original: valorOriginal,
      valor_com_taxa: valorComTaxa,
      taxa_percentual: feePercent,
      currency: provider === "stripe" ? "USD" : "BRL",
      expires_at: expiresAt,
      reference_id: referenceId,
      link_id: linkId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("[generate-payment-link] unexpected error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});