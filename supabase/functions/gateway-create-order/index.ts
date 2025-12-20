import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreateOrderBody = {
  productId: string;
  orderBumpIds?: string[];
  couponCode?: string | null;
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  customerCpf?: string | null;
  paymentGateway: "stripe" | "mercadopago";
  currency: "BRL" | "USD";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CreateOrderBody;

    if (!body?.productId || !body?.customerEmail || !body?.paymentGateway) {
      return new Response(
        JSON.stringify({ error: "productId, customerEmail e paymentGateway são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Simplify currency for customers (and avoid confusing UX)
    const currency: "BRL" | "USD" = body.paymentGateway === "stripe" ? "USD" : "BRL";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Product
    const { data: product, error: productError } = await supabase
      .from("gateway_products")
      .select("id, name, price_brl, price_usd, public_slug, status")
      .eq("id", body.productId)
      .single();

    if (productError || !product || product.status !== "active") {
      console.error("Product not found/active:", productError);
      return new Response(
        JSON.stringify({ error: "Produto não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Order bumps
    const orderBumpIds = (body.orderBumpIds || []).filter(Boolean);
    let orderBumps: Array<{ id: string; name: string; price_brl: number; price_usd: number; allow_coupon: boolean }> = [];

    if (orderBumpIds.length > 0) {
      const { data: bumps, error: bumpsError } = await supabase
        .from("gateway_order_bumps")
        .select("id, name, price_brl, price_usd, status, allow_coupon")
        .in("id", orderBumpIds)
        .eq("status", "active");

      if (bumpsError) {
        console.error("Order bumps fetch error:", bumpsError);
        return new Response(
          JSON.stringify({ error: "Erro ao carregar ofertas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      orderBumps = (bumps || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        price_brl: b.price_brl,
        price_usd: b.price_usd,
        allow_coupon: b.allow_coupon ?? true,
      }));
    }

    const getPrice = (priceBrl: number, priceUsd: number) => (currency === "USD" ? priceUsd : priceBrl);

    const subtotal =
      getPrice(product.price_brl, product.price_usd) +
      orderBumps.reduce((sum, ob) => sum + getPrice(ob.price_brl, ob.price_usd), 0);

    // Check if any selected order bump disallows coupons
    const anyBumpDisallowsCoupon = orderBumps.some((ob) => ob.allow_coupon === false);

    // Coupon
    let coupon: any = null;
    let discountAmount = 0;

    const couponCode = (body.couponCode || "").trim().toUpperCase();
    if (couponCode && !anyBumpDisallowsCoupon) {
      const { data: c, error: cError } = await supabase
        .from("gateway_coupons")
        .select("*")
        .eq("code", couponCode)
        .eq("status", "active")
        .single();

      if (!cError && c) {
        // Validate fixed currency
        if (c.discount_type === "fixed" && c.currency !== currency) {
          // ignore coupon silently for safety
          coupon = null;
        } else {
          const now = new Date();
          if (c.starts_at && new Date(c.starts_at) > now) coupon = null;
          else if (c.expires_at && new Date(c.expires_at) < now) coupon = null;
          else if (c.max_uses_global && c.usage_count >= c.max_uses_global) coupon = null;
          else {
            coupon = c;
            discountAmount =
              c.discount_type === "percentage"
                ? (subtotal * Number(c.discount_value)) / 100
                : Number(c.discount_value);
          }
        }
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("gateway_orders")
      .insert([
        {
          product_id: product.id,
          order_bump_id: orderBumpIds.length > 0 ? orderBumpIds[0] : null,
          coupon_id: coupon?.id || null,
          customer_name: body.customerName || "",
          customer_email: body.customerEmail,
          customer_phone: body.customerPhone || null,
          customer_cpf: body.customerCpf || null,
          subtotal,
          discount_amount: discountAmount,
          total,
          currency,
          status: "pending",
          payment_gateway: body.paymentGateway,
          abandoned_email_sent: false,
        },
      ])
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Create order error:", orderError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar pedido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Record coupon usage (server-side)
    if (coupon?.id) {
      await supabase.from("gateway_coupon_usages").insert([
        {
          coupon_id: coupon.id,
          order_id: order.id,
          discount_amount: discountAmount,
        },
      ]);

      await supabase
        .from("gateway_coupons")
        .update({
          usage_count: Number(coupon.usage_count || 0) + 1,
          total_discount_given: Number(coupon.total_discount_given || 0) + discountAmount,
        })
        .eq("id", coupon.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        currency,
        subtotal,
        discountAmount,
        total,
        couponBlocked: anyBumpDisallowsCoupon && couponCode ? true : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("gateway-create-order error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
